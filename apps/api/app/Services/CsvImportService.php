<?php

namespace App\Services;

use App\Models\Field;
use App\Models\Record;
use App\Models\Table;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * @phpstan-type CsvMapping array<string, array<string, mixed>>
 * @phpstan-type CsvRow array<string, string>
 * @phpstan-type ParsedCsv array{detected_encoding: string, delimiter: string, headers: list<string>, rows: list<CsvRow>}
 * @phpstan-type PendingReference array{target_table_id: string, display_field: string, value: string}
 * @phpstan-type MappedCsvRow array{data: array<string, mixed>, errors: array<string, list<string>>, warnings: list<string>, pending_references: array<string, PendingReference>}
 * @phpstan-type CsvImportSummary array<string, mixed>
 */
class CsvImportService
{
    private const NEW_REFERENCE_ULID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';

    public function __construct(
        private RecordValidationService $recordValidationService,
        private RecordLinkService $recordLinkService,
        private RecordActivityService $recordActivityService,
    ) {}

    /**
     * @param  CsvMapping|string  $mapping
     * @return CsvImportSummary
     */
    public function dryRun(Table $table, UploadedFile $file, array|string $mapping): array
    {
        return $this->process($table, $file, $this->normalizeMapping($mapping), null, false);
    }

    /**
     * @param  CsvMapping|string  $mapping
     * @return CsvImportSummary
     */
    public function import(Table $table, UploadedFile $file, array|string $mapping, User $user): array
    {
        return $this->process($table, $file, $this->normalizeMapping($mapping), $user, true);
    }

    /**
     * @param  CsvMapping  $mapping
     * @return CsvImportSummary
     */
    private function process(Table $table, UploadedFile $file, array $mapping, ?User $user, bool $shouldImport): array
    {
        $parsed = $this->parseFile($file);
        $table->loadMissing('fields', 'database');

        $pendingFields = $this->pendingFields($table, $mapping);
        $acceptedRows = [];
        $rejectedRows = [];
        $warnings = $pendingFields
            ? array_map(fn (Field $field) => "Field {$field->name} will be created.", $pendingFields)
            : [];

        if ($shouldImport) {
            if (! $user) {
                throw new \InvalidArgumentException('Import requires an authenticated user.');
            }

            return DB::transaction(function () use ($table, $mapping, $parsed, $pendingFields, $user, &$warnings) {
                $createdFields = $this->createPendingFields($table, $pendingFields);
                $importTable = Table::with('fields')->findOrFail($table->id);

                return $this->processRows(
                    $importTable,
                    $mapping,
                    $parsed,
                    [],
                    $warnings,
                    $user,
                    $createdFields
                );
            });
        }

        foreach ($parsed['rows'] as $index => $row) {
            $result = $this->mapRow($table, $row, $mapping, false);

            if ($result['errors']) {
                $rejectedRows[] = [
                    'row' => $index + 2,
                    'errors' => $result['errors'],
                    'data' => $row,
                ];

                continue;
            }

            $validation = $this->recordValidationService->validate($table, $result['data'], $pendingFields);

            if (! $validation['valid']) {
                $rejectedRows[] = [
                    'row' => $index + 2,
                    'errors' => $validation['errors'],
                    'data' => $row,
                ];

                continue;
            }

            $acceptedRows[] = [
                'row' => $index + 2,
                'data' => $this->recordValidationService->normalize($table, $result['data'], $pendingFields),
            ];
            $warnings = array_merge($warnings, $result['warnings']);
        }

        return $this->summary($parsed, $acceptedRows, $rejectedRows, $warnings);
    }

    /**
     * @param  CsvMapping  $mapping
     * @param  ParsedCsv  $parsed
     * @param  list<array<string, mixed>>  $acceptedRows
     * @param  list<string>  $warnings
     * @param  list<Field>  $createdFields
     * @return CsvImportSummary
     */
    private function processRows(
        Table $table,
        array $mapping,
        array $parsed,
        array $acceptedRows,
        array $warnings,
        User $user,
        array $createdFields
    ): array {
        $rejectedRows = [];

        foreach ($parsed['rows'] as $index => $row) {
            $result = $this->mapRow($table, $row, $mapping, true);

            if ($result['errors']) {
                $rejectedRows[] = [
                    'row' => $index + 2,
                    'errors' => $result['errors'],
                    'data' => $row,
                ];

                continue;
            }

            $validation = $this->recordValidationService->validate($table, $result['data']);

            if (! $validation['valid']) {
                $rejectedRows[] = [
                    'row' => $index + 2,
                    'errors' => $validation['errors'],
                    'data' => $row,
                ];

                continue;
            }

            $normalized = $this->recordValidationService->normalize($table, $result['data']);
            $normalized = $this->materializePendingReferences($normalized, $result['pending_references'], $user);
            $record = Record::create([
                'table_id' => $table->id,
                'data' => $normalized,
                'version' => 1,
            ]);

            $this->recordLinkService->syncLinks($record);
            $this->recordActivityService->logCreate($record, $user);

            $acceptedRows[] = [
                'row' => $index + 2,
                'record_id' => $record->id,
                'data' => $normalized,
            ];
            $warnings = array_merge($warnings, $result['warnings']);
        }

        $summary = $this->summary($parsed, $acceptedRows, $rejectedRows, $warnings);
        $summary['created_fields'] = array_map(fn (Field $field) => [
            'id' => $field->id,
            'name' => $field->name,
            'type' => $field->type,
        ], $createdFields);

        return $summary;
    }

    /**
     * @param  CsvMapping|string  $mapping
     * @return CsvMapping
     */
    private function normalizeMapping(array|string $mapping): array
    {
        if (is_string($mapping)) {
            $decoded = json_decode($mapping, true);

            if (! is_array($decoded)) {
                throw ValidationException::withMessages([
                    'mapping' => ['Mapping must be valid JSON.'],
                ]);
            }

            return $decoded;
        }

        return $mapping;
    }

    /**
     * @return ParsedCsv
     */
    private function parseFile(UploadedFile $file): array
    {
        $contents = file_get_contents($file->getRealPath());
        $encoding = mb_check_encoding($contents, 'UTF-8') ? 'UTF-8' : 'ISO-8859-1';
        $text = $encoding === 'UTF-8' ? $contents : mb_convert_encoding($contents, 'UTF-8', 'ISO-8859-1');
        $delimiter = $this->sniffDelimiter($text);

        $handle = fopen('php://temp', 'r+');
        fwrite($handle, $text);
        rewind($handle);

        $headers = fgetcsv($handle, separator: $delimiter);
        if (! is_array($headers)) {
            throw ValidationException::withMessages([
                'file' => ['CSV must include a header row.'],
            ]);
        }

        $headers = array_map(fn ($header) => trim((string) $header), $headers);
        $rows = [];

        while (($values = fgetcsv($handle, separator: $delimiter)) !== false) {
            if ($values === [null]) {
                continue;
            }

            $row = [];
            foreach ($headers as $index => $header) {
                $row[$header] = isset($values[$index]) ? trim((string) $values[$index]) : '';
            }
            $rows[] = $row;
        }

        fclose($handle);

        return [
            'detected_encoding' => $encoding,
            'delimiter' => $delimiter,
            'headers' => $headers,
            'rows' => $rows,
        ];
    }

    private function sniffDelimiter(string $text): string
    {
        $firstLine = '';
        foreach (preg_split('/\R/', $text) ?: [] as $line) {
            if (trim($line) !== '') {
                $firstLine = $line;
                break;
            }
        }

        $bestDelimiter = ',';
        $bestCount = 0;

        foreach ([',', ';', "\t"] as $delimiter) {
            $count = count(str_getcsv($firstLine, separator: $delimiter));
            if ($count > $bestCount) {
                $bestCount = $count;
                $bestDelimiter = $delimiter;
            }
        }

        return $bestDelimiter;
    }

    /**
     * @param  CsvMapping  $mapping
     * @return list<Field>
     */
    private function pendingFields(Table $table, array $mapping): array
    {
        $table->loadMissing('fields');
        $existing = $table->fields->keyBy('name');
        $pending = [];

        foreach ($mapping as $config) {
            if (($config['type'] ?? null) !== 'create_field') {
                continue;
            }

            $fieldName = $config['field'] ?? null;
            if (! is_string($fieldName) || $fieldName === '' || isset($existing[$fieldName])) {
                continue;
            }

            $pending[] = new Field([
                'table_id' => $table->id,
                'name' => $fieldName,
                'type' => $config['field_type'] ?? 'text',
                'position' => $table->fields->count() + count($pending),
                'options' => $config['options'] ?? [],
                'validation' => $config['validation'] ?? [],
            ]);
        }

        return $pending;
    }

    /**
     * @param  list<Field>  $pendingFields
     * @return list<Field>
     */
    private function createPendingFields(Table $table, array $pendingFields): array
    {
        $created = [];

        foreach ($pendingFields as $field) {
            $created[] = Field::create([
                'table_id' => $table->id,
                'name' => $field->name,
                'type' => $field->type,
                'position' => $field->position,
                'options' => $field->options ?? [],
                'validation' => $field->validation ?? [],
            ]);
        }

        return $created;
    }

    /**
     * @param  CsvRow  $row
     * @param  CsvMapping  $mapping
     * @return MappedCsvRow
     */
    private function mapRow(Table $table, array $row, array $mapping, bool $shouldCreateReferences): array
    {
        $data = [];
        $errors = [];
        $warnings = [];
        $pendingReferences = [];
        $table->loadMissing('fields');
        $fieldMap = $table->fields->keyBy('name');

        foreach ($mapping as $column => $config) {
            if (! array_key_exists($column, $row)) {
                $errors[$column][] = 'Column does not exist in CSV.';

                continue;
            }

            $value = trim((string) $row[$column]);
            $mappingType = $config['type'] ?? 'field';
            $fieldName = $config['field'] ?? $column;
            $fieldName = is_string($fieldName) ? $fieldName : (string) $column;

            if ($mappingType === 'skip') {
                continue;
            }

            if ($mappingType === 'reference') {
                $reference = $this->resolveReference($value, $config, $shouldCreateReferences);
                if ($reference['error']) {
                    $errors[$fieldName][] = $reference['error'];

                    continue;
                }

                if ($reference['warning']) {
                    $warnings[] = $reference['warning'];
                }

                $data[$fieldName] = $reference['value'];
                if ($reference['pending_reference']) {
                    $pendingReferences[$fieldName] = $reference['pending_reference'];
                }

                continue;
            }

            $field = $fieldMap->get($fieldName);
            $data[$fieldName] = $this->coerceScalar($value, $config, $field instanceof Field ? $field : null);
        }

        return [
            'data' => $data,
            'errors' => $errors,
            'warnings' => $warnings,
            'pending_references' => $pendingReferences,
        ];
    }

    /**
     * @param  array<string, mixed>  $config
     * @return array{value: mixed, error: string|null, warning: string|null, pending_reference: PendingReference|null}
     */
    private function resolveReference(string $value, array $config, bool $shouldCreate): array
    {
        if ($value === '') {
            return ['value' => null, 'error' => null, 'warning' => null, 'pending_reference' => null];
        }

        $targetTableId = $config['target_table_id'] ?? null;
        $displayField = $config['display_field'] ?? null;
        $matchOrCreate = ($config['match_or_create'] ?? false) === true;

        if (! is_string($displayField) || $displayField === '') {
            return ['value' => null, 'error' => 'Reference display field is required.', 'warning' => null, 'pending_reference' => null];
        }

        $targetTable = Table::with('fields')->find($targetTableId);
        if (! $targetTable) {
            return ['value' => null, 'error' => 'Reference target table was not found.', 'warning' => null, 'pending_reference' => null];
        }

        $displayFieldModel = $targetTable->fields->firstWhere('name', $displayField);
        if (! $displayFieldModel) {
            throw ValidationException::withMessages([
                "mapping.{$config['field']}.display_field" => ['Reference display field must exist on the target table.'],
            ]);
        }

        $existing = Record::where('table_id', $targetTable->id)
            ->where('data->'.$displayField, $value)
            ->first();

        if ($existing) {
            return ['value' => $existing->id, 'error' => null, 'warning' => null, 'pending_reference' => null];
        }

        if (! $matchOrCreate) {
            return ['value' => null, 'error' => "No matching reference found for {$value}.", 'warning' => null, 'pending_reference' => null];
        }

        if (! $shouldCreate) {
            return [
                'value' => self::NEW_REFERENCE_ULID,
                'error' => null,
                'warning' => "Reference {$value} will be created.",
                'pending_reference' => null,
            ];
        }

        return [
            'value' => self::NEW_REFERENCE_ULID,
            'error' => null,
            'warning' => "Reference {$value} was created.",
            'pending_reference' => [
                'target_table_id' => $targetTable->id,
                'display_field' => $displayField,
                'value' => $value,
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  array<string, PendingReference>  $pendingReferences
     * @return array<string, mixed>
     */
    private function materializePendingReferences(array $data, array $pendingReferences, User $user): array
    {
        foreach ($pendingReferences as $fieldName => $pendingReference) {
            $record = Record::where('table_id', $pendingReference['target_table_id'])
                ->where('data->'.$pendingReference['display_field'], $pendingReference['value'])
                ->first();

            if (! $record) {
                $record = Record::create([
                    'table_id' => $pendingReference['target_table_id'],
                    'data' => [$pendingReference['display_field'] => $pendingReference['value']],
                    'version' => 1,
                ]);

                $this->recordActivityService->logCreate($record, $user);
            }

            $data[$fieldName] = $record->id;
        }

        return $data;
    }

    /**
     * @param  array<string, mixed>  $config
     */
    private function coerceScalar(string $value, array $config, ?Field $field): mixed
    {
        $fieldType = $config['field_type'] ?? $field?->type;

        if (($config['type'] ?? null) === 'create_field') {
            $fieldType = $fieldType ?: 'text';
        }

        if ($fieldType === 'boolean') {
            return $this->coerceBoolean($value);
        }

        if ($fieldType === 'number' || (($config['field'] ?? null) && in_array($config['field'], ['Année', 'year'], true))) {
            return $value;
        }

        return $value;
    }

    private function coerceBoolean(string $value): mixed
    {
        $normalized = mb_strtolower($value);

        return match ($normalized) {
            'oui', 'yes', 'true', '1' => true,
            'non', 'no', 'false', '0' => false,
            default => $value,
        };
    }

    /**
     * @param  ParsedCsv  $parsed
     * @param  list<array<string, mixed>>  $acceptedRows
     * @param  list<array<string, mixed>>  $rejectedRows
     * @param  list<string>  $warnings
     * @return CsvImportSummary
     */
    private function summary(array $parsed, array $acceptedRows, array $rejectedRows, array $warnings): array
    {
        return [
            'detected_encoding' => $parsed['detected_encoding'],
            'delimiter' => $parsed['delimiter'],
            'headers' => $parsed['headers'],
            'row_count' => count($parsed['rows']),
            'accepted_count' => count($acceptedRows),
            'rejected_count' => count($rejectedRows),
            'warnings' => array_values(array_unique($warnings)),
            'accepted_rows' => $acceptedRows,
            'rejected_rows' => $rejectedRows,
        ];
    }
}
