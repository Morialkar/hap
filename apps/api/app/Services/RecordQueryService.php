<?php

namespace App\Services;

use App\Models\Field;
use App\Models\Record;
use App\Models\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class RecordQueryService
{
    /**
     * Query records with filters, search, sort, and pagination.
     */
    public function queryRecords(Table $table, array $params): array
    {
        $query = Record::with('table')->where('table_id', $table->id);

        // Apply search
        if (! empty($params['search'])) {
            $this->applySearch($query, $params['search']);
        }

        // Apply filters
        if (! empty($params['filters'])) {
            $this->applyFilters($query, $table, $params['filters']);
        }

        // Apply sorting
        if (! empty($params['sort'])) {
            $this->applySort($query, $table, $params['sort'], $params['sort_dir'] ?? 'asc');
        }

        // Apply cursor pagination
        $perPage = $params['per_page'] ?? 20;
        $cursor = $params['cursor'] ?? null;

        if ($cursor) {
            $this->applyCursorPagination($query, $cursor, $params['sort'] ?? 'created_at', $params['sort_dir'] ?? 'asc');
        }

        $records = $query->paginate($perPage);

        return [
            'data' => $records->items(),
            'pagination' => [
                'current_page' => $records->currentPage(),
                'per_page' => $records->perPage(),
                'total' => $records->total(),
                'last_page' => $records->lastPage(),
                'next_cursor' => $this->getNextCursor($records, $params['sort'] ?? 'created_at'),
                'prev_cursor' => $this->getPrevCursor($records, $params['sort'] ?? 'created_at'),
            ],
        ];
    }

    /**
     * Apply full-text search across text fields.
     */
    private function applySearch(Builder $query, string $searchTerm): void
    {
        // Only apply full-text search if search_vector column exists (PostgreSQL)
        if (DB::getDriverName() === 'pgsql' && Schema::hasColumn('records', 'search_vector')) {
            $query->whereRaw('search_vector @@ to_tsquery(?)', [$searchTerm]);
        } else {
            // Fallback to LIKE search for SQLite
            $query->where('data', 'LIKE', "%{$searchTerm}%");
        }
    }

    /**
     * Apply filters based on field/operator/value AST.
     */
    private function applyFilters(Builder $query, Table $table, array $filters): void
    {
        foreach ($filters as $filter) {
            $field = $table->fields->where('name', $filter['field'])->first();

            if (! $field) {
                continue;
            }

            $this->applyFieldFilter($query, $field, $filter['operator'], $filter['value']);
        }
    }

    /**
     * Apply a single field filter.
     */
    private function applyFieldFilter(Builder $query, Field $field, string $operator, mixed $value): void
    {
        $fieldName = $field->name;

        // Handle reference field filtering via record_links
        if ($field->type === 'reference') {
            $this->applyReferenceFilter($query, $field, $operator, $value);

            return;
        }

        // Handle JSONB field filtering
        $jsonPath = "data->>'{$fieldName}'";

        match ($operator) {
            'eq' => $query->whereRaw("{$jsonPath} = ?", [$value]),
            'neq' => $query->whereRaw("{$jsonPath} != ?", [$value]),
            'gt' => $query->whereRaw("CAST({$jsonPath} AS NUMERIC) > ?", [$value]),
            'gte' => $query->whereRaw("CAST({$jsonPath} AS NUMERIC) >= ?", [$value]),
            'lt' => $query->whereRaw("CAST({$jsonPath} AS NUMERIC) < ?", [$value]),
            'lte' => $query->whereRaw("CAST({$jsonPath} AS NUMERIC) <= ?", [$value]),
            'contains' => $query->whereRaw("{$jsonPath} ILIKE ?", ["%{$value}%"]),
            'starts_with' => $query->whereRaw("{$jsonPath} ILIKE ?", ["{$value}%"]),
            'ends_with' => $query->whereRaw("{$jsonPath} ILIKE ?", ["%{$value}"]),
            'is_null' => $query->whereNull("data->{$fieldName}"),
            'is_not_null' => $query->whereNotNull("data->{$fieldName}"),
            'in' => $query->whereRaw("{$jsonPath} = ANY(?)", [json_encode($value)]),
            default => null,
        };
    }

    /**
     * Apply reference field filtering using record_links.
     */
    private function applyReferenceFilter(Builder $query, Field $field, string $operator, mixed $value): void
    {
        $isMulti = ($field->options['multi'] ?? false) === true;
        $targetIds = $isMulti ? (array) $value : [$value];

        match ($operator) {
            'eq' => $query->whereHas('linksFrom', function ($q) use ($field, $targetIds) {
                $q->where('field_id', $field->id)
                    ->whereIn('to_record', $targetIds);
            }),
            'neq' => $query->whereDoesntHave('linksFrom', function ($q) use ($field, $targetIds) {
                $q->where('field_id', $field->id)
                    ->whereIn('to_record', $targetIds);
            }),
            default => null,
        };
    }

    /**
     * Apply sorting with French accent ordering.
     */
    private function applySort(Builder $query, Table $table, string $sortField, string $direction): void
    {
        $field = $table->fields->where('name', $sortField)->first();

        if (! $field) {
            // Default to created_at
            $query->orderBy('created_at', $direction);

            return;
        }

        $database = $table->database;
        $locale = $database->locale ?? 'fr-CA';

        // Use ICU collation for French accent ordering (PostgreSQL only)
        if (DB::getDriverName() === 'pgsql') {
            $collation = $this->getCollationForLocale($locale);
            $jsonPath = "data->>'{$field->name}'";
            $query->orderByRaw("CAST({$jsonPath} AS TEXT) COLLATE \"{$collation}\" {$direction}");
        } else {
            // Fallback for SQLite - simple sort
            $jsonPath = "data->>'{$field->name}'";
            $query->orderByRaw("CAST({$jsonPath} AS TEXT) {$direction}");
        }
    }

    /**
     * Get PostgreSQL collation for locale.
     */
    private function getCollationForLocale(string $locale): string
    {
        return match ($locale) {
            'fr-CA', 'fr-FR' => 'fr-x-icu',
            'en-US', 'en-GB' => 'en-x-icu',
            'es-ES' => 'es-x-icu',
            'de-DE' => 'de-x-icu',
            default => 'und-x-icu', // Universal
        };
    }

    /**
     * Apply cursor pagination.
     */
    private function applyCursorPagination(Builder $query, string $cursor, string $sortField, string $direction): void
    {
        $cursorData = json_decode(base64_decode($cursor), true);

        if ($direction === 'asc') {
            $query->where($sortField, '>', $cursorData[$sortField]);
        } else {
            $query->where($sortField, '<', $cursorData[$sortField]);
        }
    }

    /**
     * Get next cursor for pagination.
     */
    private function getNextCursor($records, string $sortField): ?string
    {
        if ($records->isEmpty()) {
            return null;
        }

        $lastRecord = $records->last();

        return base64_encode(json_encode([$sortField => $lastRecord->$sortField]));
    }

    /**
     * Get previous cursor for pagination.
     */
    private function getPrevCursor($records, string $sortField): ?string
    {
        if ($records->isEmpty()) {
            return null;
        }

        $firstRecord = $records->first();

        return base64_encode(json_encode([$sortField => $firstRecord->$sortField]));
    }
}
