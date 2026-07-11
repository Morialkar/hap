<?php

namespace App\Services;

use App\FieldTypes\FieldTypeRegistry;
use App\Models\Field;
use App\Models\Table;
use Illuminate\Support\Collection;

class RecordValidationService
{
    private static array $fieldsCache = [];

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
            if ($field->type === 'compound') {
                continue;
            }
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

        // First pass: serialize non-compound fields
        foreach ($data as $fieldName => $value) {
            if (! isset($fieldMap[$fieldName])) {
                continue;
            }

            $field = $fieldMap[$fieldName];
            if ($field->type === 'compound') {
                continue;
            }

            $fieldType = $this->fieldTypeRegistry->get($field->type);
            $normalized[$fieldName] = $fieldType->serialize($value, $field->options ?? []);
        }

        // Second pass: compute compound fields
        foreach ($fieldMap as $fieldName => $field) {
            if ($field->type !== 'compound') {
                continue;
            }

            $template = $field->options['template'] ?? '';
            $computedValue = preg_replace_callback('/\$\{([^}]+)\}/', function ($matches) use ($normalized) {
                $refFieldName = $matches[1];
                return $normalized[$refFieldName] ?? '';
            }, $template);

            $normalized[$fieldName] = $computedValue;
        }

        return $normalized;
    }

    /**
     * Compute compound fields dynamically for output/display.
     */
    public function computeCompoundFields(Table $table, array $data): array
    {
        $fieldMap = $this->fieldsFor($table, [])->keyBy('name');

        foreach ($fieldMap as $fieldName => $field) {
            if ($field->type !== 'compound') {
                continue;
            }

            $template = $field->options['template'] ?? '';
            $computedValue = preg_replace_callback('/\$\{([^}]+)\}/', function ($matches) use ($data) {
                $refFieldName = $matches[1];
                return $data[$refFieldName] ?? '';
            }, $template);

            $data[$fieldName] = $computedValue;
        }

        return $data;
    }

    /**
     * @param  list<Field>  $extraFields
     * @return Collection<int, Field>
     */
    private function fieldsFor(Table $table, array $extraFields): Collection
    {
        $cacheKey = $table->id;
        if (! isset(self::$fieldsCache[$cacheKey])) {
            self::$fieldsCache[$cacheKey] = Field::query()
                ->where('table_id', $table->id)
                ->orderBy('position')
                ->get();
        }

        return self::$fieldsCache[$cacheKey]
            ->concat($extraFields)
            ->values();
    }
}
