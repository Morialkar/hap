<?php

namespace App\Services;

use App\Models\Field;
use App\Models\Record;
use App\Models\RecordLink;
use Illuminate\Support\Facades\DB;

class RecordLinkService
{
    /**
     * Sync record links for a record based on its reference field values.
     */
    public function syncLinks(Record $record): void
    {
        $table = $record->table()->with('fields')->first();
        $referenceFields = $table->fields->where('type', 'reference');

        DB::transaction(function () use ($record, $referenceFields) {
            // Delete existing links for this record
            RecordLink::where('from_record', $record->id)->delete();

            // Create new links based on current reference field values
            foreach ($referenceFields as $field) {
                $fieldName = $field->name;
                $value = $record->data[$fieldName] ?? null;

                if ($value === null || $value === '') {
                    continue;
                }

                $isMulti = ($field->options['multi'] ?? false) === true;
                $targetIds = $isMulti ? (array) $value : [$value];

                foreach ($targetIds as $targetId) {
                    if (empty($targetId)) {
                        continue;
                    }

                    RecordLink::create([
                        'from_record' => $record->id,
                        'field_id' => $field->id,
                        'to_record' => $targetId,
                    ]);
                }
            }
        });
    }

    /**
     * Get all records that reference a specific record.
     */
    public function getReferencingRecords(Record $record, int $page = 1, int $perPage = 20): array
    {
        $links = RecordLink::where('to_record', $record->id)
            ->with(['fromRecord', 'field'])
            ->paginate($perPage, ['*'], 'page', $page);

        return [
            'data' => $links->map(function ($link) {
                return [
                    'record_id' => $link->from_record,
                    'table_id' => $link->fromRecord->table_id,
                    'field_id' => $link->field_id,
                    'field_name' => $link->field->name,
                    'record_data' => $link->fromRecord->data,
                ];
            })->toArray(),
            'pagination' => [
                'current_page' => $links->currentPage(),
                'per_page' => $links->perPage(),
                'total' => $links->total(),
                'last_page' => $links->lastPage(),
            ],
        ];
    }

    /**
     * Check if a record is referenced by other records.
     */
    public function getReferenceCounts(Record $record): array
    {
        $links = RecordLink::where('to_record', $record->id)
            ->with('field')
            ->get()
            ->groupBy('field_id');

        $counts = [];
        foreach ($links as $fieldId => $fieldLinks) {
            $field = $fieldLinks->first()->field;
            $counts[] = [
                'field_id' => $fieldId,
                'field_name' => $field->name,
                'count' => $fieldLinks->count(),
            ];
        }

        return [
            'total' => RecordLink::where('to_record', $record->id)->count(),
            'by_field' => $counts,
        ];
    }

    /**
     * Reassign all links from one record to another.
     */
    public function reassignLinks(Record $fromRecord, Record $toRecord): void
    {
        if ($fromRecord->table_id !== $toRecord->table_id) {
            throw new \InvalidArgumentException('Records must be from the same table');
        }

        DB::transaction(function () use ($fromRecord, $toRecord) {
            RecordLink::where('to_record', $fromRecord->id)
                ->update(['to_record' => $toRecord->id]);
        });
    }
}
