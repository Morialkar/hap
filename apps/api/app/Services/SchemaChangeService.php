<?php

namespace App\Services;

use App\Models\Field;
use App\Models\SchemaChange;
use App\Models\Table;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class SchemaChangeService
{
    /**
     * Determine if a field change is destructive.
     */
    public function isDestructiveChange(Field $field, array $newData): bool
    {
        // Deleting a field is always destructive
        if (isset($newData['_delete'])) {
            return true;
        }

        // Changing type is destructive
        if (isset($newData['type']) && $newData['type'] !== $field->type) {
            return $this->isIncompatibleTypeChange($field->type, $newData['type']);
        }

        return false;
    }

    /**
     * Check if type change is incompatible.
     */
    private function isIncompatibleTypeChange(string $oldType, string $newType): bool
    {
        // Define compatible type transitions
        $compatible = [
            'text' => ['long_text'],
            'long_text' => ['text'],
            'number' => [],
            'date' => [],
            'boolean' => [],
            'select' => [],
            'reference' => [],
            'image' => [],
            'file' => [],
            'url' => [],
            'email' => ['text'],
        ];

        return !in_array($newType, $compatible[$oldType] ?? []);
    }

    /**
     * Calculate data impact for a destructive change.
     */
    public function calculateDataImpact(Field $field, array $newData): array
    {
        $impact = [
            'affected_records' => 0,
            'orphaned_values' => 0,
            'coercion_required' => false,
        ];

        // Check if records table exists
        if (!Schema::hasTable('records')) {
            return $impact;
        }

        // Count records with values in this field
        $fieldName = $field->name;
        
        $affectedRecords = DB::table('records')
            ->where('table_id', $field->table_id)
            ->whereNotNull("data->{$fieldName}")
            ->where("data->{$fieldName}", '!=', '')
            ->count();

        $impact['affected_records'] = $affectedRecords;
        $impact['orphaned_values'] = $affectedRecords;

        // Check if coercion would be required for type changes
        if (isset($newData['type']) && $newData['type'] !== $field->type) {
            $impact['coercion_required'] = true;
        }

        return $impact;
    }

    /**
     * Validate confirmation token for destructive change.
     */
    public function validateConfirmationToken(Table $table, string $token): bool
    {
        // Token should be a hash of table_id + timestamp
        $expected = hash('sha256', $table->id . date('Y-m-d'));
        return hash_equals($expected, $token);
    }

    /**
     * Generate confirmation token for a table.
     */
    public function generateConfirmationToken(Table $table): string
    {
        return hash('sha256', $table->id . date('Y-m-d'));
    }

    /**
     * Record a schema change.
     */
    public function recordChange(
        Table $table,
        string $changeType,
        array $details,
        string $userId
    ): SchemaChange {
        return SchemaChange::create([
            'table_id' => $table->id,
            'change_type' => $changeType,
            'details' => $details,
            'user_id' => $userId,
        ]);
    }

    /**
     * Retain orphaned values in record JSONB under tombstoned key.
     */
    public function retainOrphanedValues(Field $field): void
    {
        // Check if records table exists
        if (!Schema::hasTable('records')) {
            return;
        }

        $fieldName = $field->name;
        $tombstoneKey = "_deleted_{$fieldName}_tombstone";

        DB::table('records')
            ->where('table_id', $field->table_id)
            ->whereNotNull("data->{$fieldName}")
            ->where("data->{$fieldName}", '!=', '')
            ->update([
                "data->{$tombstoneKey}" => DB::raw("data->'{$fieldName}'"),
            ]);
    }
}
