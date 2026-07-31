<?php

namespace App\Services;

use App\Models\Field;
use App\Models\Record;
use App\Models\Table;
use Illuminate\Database\Eloquent\Builder;

class ReportQueryService
{
    /** @return array{columns: list<string>, groups: list<array{key: string, records: list<array<string, mixed>}>} */
    public function execute(Table $table, array $ast, ?int $perPage = null, ?int $page = null, ?array $layout = null): array
    {
        $table->loadMissing('fields');
        $query = Record::query()->where('table_id', $table->id)->with('linksFrom.toRecord');
        if (isset($ast['where'])) {
            $this->applyGroup($query, $table, $ast['where']);
        }

        foreach ($ast['sort'] ?? [] as $sort) {
            $field = $this->field($table, $sort['field'] ?? '');
            if ($field) {
                $query->orderByRaw("data->>'{$field->name}' ".(($sort['direction'] ?? 'asc') === 'desc' ? 'desc' : 'asc'));
            }
        }

        $columns = array_values($ast['select'] ?? $table->fields->pluck('name')->all());
        $groupBy = $ast['group_by'] ?? null;

        if ($perPage !== null) {
            $records = $query->paginate($perPage, ['*'], 'page', $page);
            $collection = $records->getCollection();
        } else {
            $collection = $query->get();
            $records = null;
        }

        $groups = $collection->groupBy(function (Record $record) use ($groupBy, $table) {
            if (! $groupBy) {
                return '';
            }
            $val = $this->resolveValue($record, $table, $groupBy);
            if (is_array($val)) {
                return implode(', ', $val);
            }

            return (string) ($val ?? 'Inconnu');
        })
            ->map(fn ($records, $key) => [
                'key' => (string) $key,
                'records' => $records->map(fn (Record $record) => $this->project($record, $table, $columns))->values()->all(),
            ])
            ->values()->all();

        if ($layout) {
            $layoutFields = $layout['fields'] ?? [];
            if (! empty($layoutFields)) {
                usort($layoutFields, fn ($a, $b) => ($a['order'] ?? 0) <=> ($b['order'] ?? 0));
                $visibleColumns = [];
                foreach ($layoutFields as $lf) {
                    if ($lf['visible'] ?? true) {
                        $visibleColumns[] = $lf['name'];
                    }
                }
                if (! empty($visibleColumns)) {
                    $columns = $visibleColumns;
                    foreach ($groups as &$group) {
                        foreach ($group['records'] as &$record) {
                            $orderedRecord = ['id' => $record['id']];
                            foreach ($columns as $col) {
                                $orderedRecord[$col] = $record[$col] ?? null;
                            }
                            $record = $orderedRecord;
                        }
                    }
                }
            }

            $groupOrder = $layout['group_order'] ?? null;
            if (is_array($groupOrder) && ! empty($groupOrder)) {
                usort($groups, function ($a, $b) use ($groupOrder) {
                    $posA = array_search($a['key'], $groupOrder);
                    $posB = array_search($b['key'], $groupOrder);
                    $posA = $posA === false ? 999999 : $posA;
                    $posB = $posB === false ? 999999 : $posB;

                    return $posA <=> $posB;
                });
            }
        }

        $result = ['columns' => $columns, 'groups' => $groups];

        if ($records) {
            $result['pagination'] = [
                'current_page' => $records->currentPage(),
                'per_page' => $records->perPage(),
                'total' => $records->total(),
                'last_page' => $records->lastPage(),
            ];
        }

        return $result;
    }

    private function applyGroup(Builder $query, Table $table, array $group, string $boolean = 'and'): void
    {
        $logic = strtolower($group['logic'] ?? 'and') === 'or' ? 'or' : 'and';
        $method = $boolean === 'or' ? 'orWhere' : 'where';
        $query->{$method}(function (Builder $nested) use ($table, $group, $logic) {
            foreach ($group['conditions'] ?? [] as $condition) {
                if (isset($condition['conditions'])) {
                    $this->applyGroup($nested, $table, $condition, $logic);
                } else {
                    $this->applyCondition($nested, $table, $condition, $logic);
                }
            }
        });
    }

    private function applyCondition(Builder $query, Table $table, array $condition, string $boolean = 'and'): void
    {
        $fieldName = $condition['field'] ?? '';
        $operator = $condition['operator'] ?? 'eq';
        $value = $condition['value'] ?? null;
        if (str_contains($fieldName, '.')) {
            [$reference, $target] = explode('.', $fieldName, 2);
            $field = $this->field($table, $reference);
            if (! $field || $field->type !== 'reference') {
                return;
            }
            $method = $boolean === 'or' ? 'orWhereHas' : 'whereHas';
            $query->{$method}('linksFrom', fn (Builder $links) => $links->where('field_id', $field->id)->whereHas('toRecord', fn (Builder $records) => $this->scalar($records, $target, $operator, $value)));

            return;
        }
        if ($field = $this->field($table, $fieldName)) {
            $this->scalar($query, $field->name, $operator, $value, $boolean);
        }
    }

    private function scalar(Builder $query, string $field, string $operator, mixed $value, string $boolean = 'and'): void
    {
        $path = "data->>'{$field}'";
        $prefix = $boolean === 'or' ? 'orWhere' : 'where';
        match ($operator) {
            'contains' => $query->{$prefix.'Raw'}("{$path} LIKE ?", ["%{$value}%"]),
            'neq' => $query->{$prefix.'Raw'}("{$path} != ?", [$value]),
            'gt', 'gte', 'lt', 'lte' => $query->{$prefix.'Raw'}("CAST({$path} AS NUMERIC) ".match ($operator) {
                'gt' => '>', 'gte' => '>=', 'lt' => '<', 'lte' => '<='
            }.' ?', [$value]),
            'is_null' => $query->{$prefix.'Null'}("data->{$field}"),
            default => $query->{$prefix.'Raw'}("{$path} = ?", [$value]),
        };
    }

    private function project(Record $record, Table $table, array $columns): array
    {
        $row = ['id' => $record->id];
        foreach ($columns as $column) {
            $row[$column] = $this->resolveValue($record, $table, $column);
        }

        return $row;
    }

    private function resolveValue(Record $record, Table $table, string $column): mixed
    {
        if (str_contains($column, '.')) {
            [$referenceName, $fieldName] = explode('.', $column, 2);
            $field = $this->field($table, $referenceName);
            if ($field && $field->type === 'reference') {
                $links = $record->linksFrom->where('field_id', $field->id);
                $isMulti = ($field->options['multi'] ?? false) === true;
                if ($isMulti) {
                    return $links->map(function ($link) use ($fieldName) {
                        $toRecord = $link->toRecord;
                        if ($toRecord) {
                            if (in_array(strtolower($fieldName), ['id', 'created_at', 'updated_at', 'table_id', 'version'])) {
                                return $toRecord->{strtolower($fieldName)};
                            }

                            $targetTable = $toRecord->table;
                            if ($targetTable) {
                                $targetField = $targetTable->fields->first(fn ($f) => strcasecmp($f->name, $fieldName) === 0);
                                if ($targetField) {
                                    return $toRecord->data[$targetField->name] ?? null;
                                }
                            }

                            return $toRecord->data[$fieldName] ?? null;
                        }

                        return null;
                    })->filter(fn ($val) => ! is_null($val))->values()->all();
                } else {
                    $link = $links->first();
                    if ($link && $link->toRecord) {
                        $toRecord = $link->toRecord;
                        if (in_array(strtolower($fieldName), ['id', 'created_at', 'updated_at', 'table_id', 'version'])) {
                            return $toRecord->{strtolower($fieldName)};
                        }

                        $targetTable = $toRecord->table;
                        if ($targetTable) {
                            $targetField = $targetTable->fields->first(fn ($f) => strcasecmp($f->name, $fieldName) === 0);
                            if ($targetField) {
                                return $toRecord->data[$targetField->name] ?? null;
                            }
                        }

                        return $toRecord->data[$fieldName] ?? null;
                    }

                    return null;
                }
            }
        }

        $field = $this->field($table, $column);
        if ($field) {
            if ($field->type === 'reference') {
                $links = $record->linksFrom->where('field_id', $field->id);
                $isMulti = ($field->options['multi'] ?? false) === true;
                $targetTableId = $field->options['target_table'] ?? null;
                if ($targetTableId) {
                    $targetTable = Table::with('fields')->find($targetTableId);
                    if ($targetTable) {
                        $titleField = $targetTable->fields->first(fn ($f) => ($f->options['is_title'] ?? false) === true)
                            ?? $targetTable->fields->firstWhere('type', 'title');
                        $titleFieldName = $titleField ? $titleField->name : null;

                        if ($isMulti) {
                            return $links->map(function ($link) use ($titleFieldName) {
                                $toRecord = $link->toRecord;
                                if ($toRecord) {
                                    return $titleFieldName ? ($toRecord->data[$titleFieldName] ?? null) : $toRecord->id;
                                }

                                return null;
                            })->filter(fn ($val) => ! is_null($val))->values()->all();
                        } else {
                            $link = $links->first();
                            if ($link && $link->toRecord) {
                                $toRecord = $link->toRecord;

                                return $titleFieldName ? ($toRecord->data[$titleFieldName] ?? null) : $toRecord->id;
                            }

                            return null;
                        }
                    }
                }
            }

            return $record->data[$field->name] ?? null;
        }

        return $record->data[$column] ?? null;
    }

    private function field(Table $table, string $name): ?Field
    {
        return $table->fields->first(fn ($f) => strcasecmp($f->name, $name) === 0);
    }
}
