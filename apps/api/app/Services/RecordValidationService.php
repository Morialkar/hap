<?php

namespace App\Services;

use App\FieldTypes\FieldTypeRegistry;
use App\Models\Field;
use App\Models\Table;
use Illuminate\Support\Collection;

class RecordValidationService
{
    public function __construct(private FieldTypeRegistry $fieldTypeRegistry) {}

    /**
     * @param  array<string, mixed>  $data
     * @param  list<Field>  $extraFields
     * @return array{valid: bool, errors: array<string, list<string>>}
     */
    public function validate(Table $table, array $data, array $extraFields = []): array
    {
        $errors = [];
        $fieldMap = $this->fieldsFor($table, $extraFields)->keyBy('name');

        foreach (array_keys($data) as $fieldName) {
            if (! isset($fieldMap[$fieldName])) {
                $errors[$fieldName][] = 'Unknown field';
            }
        }

        foreach ($fieldMap as $fieldName => $field) {
            $value = $data[$fieldName] ?? null;
            $fieldType = $this->fieldTypeRegistry->get($field->type);
            $result = $fieldType->validate($value, $field->options ?? []);

            if (! $result['valid']) {
                $errors[$fieldName][] = (string) ($result['error'] ?? 'Invalid value');
            }
        }

        return [
            'valid' => empty($errors),
            'errors' => $errors,
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  list<Field>  $extraFields
     * @return array<string, mixed>
     */
    public function normalize(Table $table, array $data, array $extraFields = []): array
    {
        $normalized = [];
        $fieldMap = $this->fieldsFor($table, $extraFields)->keyBy('name');

        foreach ($data as $fieldName => $value) {
            if (! isset($fieldMap[$fieldName])) {
                continue;
            }

            $field = $fieldMap[$fieldName];
            $fieldType = $this->fieldTypeRegistry->get($field->type);
            $normalized[$fieldName] = $fieldType->serialize($value, $field->options ?? []);
        }

        return $normalized;
    }

    /**
     * @param  list<Field>  $extraFields
     * @return Collection<int, Field>
     */
    private function fieldsFor(Table $table, array $extraFields): Collection
    {
        return Field::query()
            ->where('table_id', $table->id)
            ->orderBy('position')
            ->get()
            ->concat($extraFields)
            ->values();
    }
}
