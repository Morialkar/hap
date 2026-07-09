<?php

namespace App\Services;

use App\Models\Database;
use App\Models\Field;
use App\Models\Report;
use App\Models\Table;
use App\Models\Template;
use App\Models\View;
use App\Models\Workspace;
use App\Models\Record;
use App\Services\RecordValidationService;
use App\Services\RecordLinkService;
use App\Services\RecordActivityService;
use Symfony\Component\Uid\Ulid;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TemplateInstallService
{
    public function __construct(
        private RecordValidationService $recordValidationService,
        private RecordLinkService $recordLinkService,
        private RecordActivityService $recordActivityService,
    ) {}

    public function install(Workspace $workspace, array $template): array
    {
        $this->validatePayload($template);

        return DB::transaction(function () use ($workspace, $template) {
            $payload = $template['payload'];

            $database = Database::create([
                'workspace_id' => $workspace->id,
                'name' => $payload['database']['name'],
                'locale' => $payload['database']['locale'] ?? 'fr-CA',
            ]);

            $tableIds = [];
            $fieldIds = [];

            foreach ($payload['tables'] as $tableDefinition) {
                $table = Table::create([
                    'database_id' => $database->id,
                    'name' => $tableDefinition['name'],
                ]);

                $tableIds[$tableDefinition['key']] = $table->id;
            }

            foreach ($payload['tables'] as $tableDefinition) {
                foreach ($tableDefinition['fields'] as $fieldDefinition) {
                    $field = Field::create([
                        'table_id' => $tableIds[$tableDefinition['key']],
                        'name' => $fieldDefinition['name'],
                        'type' => $fieldDefinition['type'],
                        'position' => $fieldDefinition['position'] ?? 0,
                        'options' => $this->replaceKeys($fieldDefinition['options'] ?? [], $tableIds),
                        'validation' => $fieldDefinition['validation'] ?? [],
                    ]);

                    $fieldIds[$fieldDefinition['key']] = $field->id;
                }
            }

            $keyMap = array_merge($tableIds, $fieldIds);

            foreach ($payload['tables'] as $tableDefinition) {
                $tableId = $tableIds[$tableDefinition['key']];

                foreach ($tableDefinition['views'] ?? [] as $viewDefinition) {
                    View::create([
                        'table_id' => $tableId,
                        'name' => $viewDefinition['name'],
                        'type' => $viewDefinition['type'],
                        'config' => $this->replaceKeys($viewDefinition['config'] ?? [], $keyMap),
                    ]);
                }

                foreach ($tableDefinition['reports'] ?? [] as $reportDefinition) {
                    Report::create([
                        'table_id' => $tableId,
                        'name' => $reportDefinition['name'],
                        'query' => $this->replaceKeys($reportDefinition['query'] ?? [], $keyMap),
                        'layout' => $this->replaceKeys($reportDefinition['layout'] ?? [], $keyMap),
                    ]);
                }
            }

            // Install demo records if present
            if (! empty($payload['demo_records'])) {
                $recordIdMap = [];

                // Pass 1: Generate all record ULIDs beforehand to resolve cross-references
                foreach ($payload['demo_records'] as $demoTableGroup) {
                    $tableKey = $demoTableGroup['table'];
                    $tableId = $tableIds[$tableKey] ?? null;
                    if (! $tableId) {
                        continue;
                    }

                    foreach ($demoTableGroup['records'] as $index => $recordData) {
                        $tempKey = $recordData['id'] ?? ($tableKey . '_' . $index);
                        $recordIdMap[$tempKey] = (string) new Ulid();
                    }
                }

                // Pass 2: Map, validate, create records and sync links
                foreach ($payload['demo_records'] as $demoTableGroup) {
                    $tableKey = $demoTableGroup['table'];
                    $tableId = $tableIds[$tableKey] ?? null;
                    if (! $tableId) {
                        continue;
                    }

                    $tableModel = Table::with('fields')->find($tableId);
                    $tableDef = collect($payload['tables'])->firstWhere('key', $tableKey);
                    $fieldsByKey = $tableDef['fields'] ?? [];
                    
                    $fieldKeyToName = collect($fieldsByKey)->pluck('name', 'key')->all();
                    $fieldKeyToType = collect($fieldsByKey)->pluck('type', 'key')->all();

                    foreach ($demoTableGroup['records'] as $index => $recordData) {
                        $tempKey = $recordData['id'] ?? ($tableKey . '_' . $index);
                        $realId = $recordIdMap[$tempKey];

                        $normalizedData = [];
                        foreach ($recordData as $fieldKey => $value) {
                            if ($fieldKey === 'id') {
                                continue;
                            }

                            $fieldName = $fieldKeyToName[$fieldKey] ?? null;
                            if (! $fieldName) {
                                continue;
                            }

                            $fieldType = $fieldKeyToType[$fieldKey] ?? 'text';

                            if ($fieldType === 'reference') {
                                if (is_array($value)) {
                                    $normalizedData[$fieldName] = array_map(fn ($val) => $recordIdMap[$val] ?? $val, $value);
                                } else {
                                    $normalizedData[$fieldName] = $recordIdMap[$value] ?? $value;
                                }
                            } else {
                                $normalizedData[$fieldName] = $value;
                            }
                        }

                        $record = new Record();
                        $record->id = $realId;
                        $record->table_id = $tableId;
                        $record->data = $this->recordValidationService->normalize($tableModel, $normalizedData);
                        $record->version = 1;
                        $record->save();

                        $this->recordLinkService->syncLinks($record);
                        
                        if (auth()->check()) {
                            $this->recordActivityService->logCreate($record, auth()->user());
                        }
                    }
                }
            }

            $storedTemplate = Template::create([
                'database_id' => $database->id,
                'name' => $template['name'],
                'description' => $template['description'] ?? null,
                'format_version' => $template['format_version'],
                'template_version' => $template['template_version'],
                'schema' => $payload,
                'payload' => $payload,
                'includes_demo_records' => ! empty($payload['demo_records']),
            ]);

            return [
                'database' => $database,
                'template' => $storedTemplate,
            ];
        });
    }

    private function validatePayload(array $template): void
    {
        $payload = $template['payload'] ?? null;

        if (! is_array($payload) || ! isset($payload['database'], $payload['tables']) || ! is_array($payload['tables'])) {
            throw ValidationException::withMessages([
                'payload' => ['Template payload must include a database object and tables array.'],
            ]);
        }

        $tableKeys = [];

        foreach ($payload['tables'] as $tableIndex => $table) {
            if (! is_array($table) || empty($table['key']) || empty($table['name'])) {
                throw ValidationException::withMessages([
                    "payload.tables.{$tableIndex}" => ['Each table must include a key and name.'],
                ]);
            }

            if (isset($tableKeys[$table['key']])) {
                throw ValidationException::withMessages([
                    "payload.tables.{$tableIndex}.key" => ['Table keys must be unique.'],
                ]);
            }

            if (! array_key_exists('fields', $table) || ! is_array($table['fields'])) {
                throw ValidationException::withMessages([
                    "payload.tables.{$tableIndex}.fields" => ['Each table must include a fields array.'],
                ]);
            }

            $tableKeys[$table['key']] = true;
        }

        foreach ($payload['tables'] as $tableIndex => $table) {
            $fieldKeys = [];

            foreach (($table['fields'] ?? []) as $fieldIndex => $field) {
                if (! is_array($field) || empty($field['key']) || empty($field['name']) || empty($field['type'])) {
                    throw ValidationException::withMessages([
                        "payload.tables.{$tableIndex}.fields.{$fieldIndex}" => ['Each field must include a key, name, and type.'],
                    ]);
                }

                if (isset($fieldKeys[$field['key']])) {
                    throw ValidationException::withMessages([
                        "payload.tables.{$tableIndex}.fields.{$fieldIndex}.key" => ['Field keys must be unique within a table.'],
                    ]);
                }

                $fieldKeys[$field['key']] = true;

                $targetTable = $field['options']['target_table'] ?? null;
                if (($field['type'] ?? null) === 'reference' && (! is_string($targetTable) || ! isset($tableKeys[$targetTable]))) {
                    throw ValidationException::withMessages([
                        "payload.tables.{$tableIndex}.fields.{$fieldIndex}.options.target_table" => ['Reference fields must target an existing template table key.'],
                    ]);
                }
            }
        }
    }

    private function replaceKeys(mixed $value, array $keyMap): mixed
    {
        if (is_string($value)) {
            return $keyMap[$value] ?? $value;
        }

        if (! is_array($value)) {
            return $value;
        }

        $replaced = [];

        foreach ($value as $key => $item) {
            $replaced[$key] = $this->replaceKeys($item, $keyMap);
        }

        return $replaced;
    }
}
