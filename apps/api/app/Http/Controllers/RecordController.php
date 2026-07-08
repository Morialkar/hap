<?php

namespace App\Http\Controllers;

use App\FieldTypes\FieldTypeRegistry;
use App\Http\Requests\StoreRecordRequest;
use App\Http\Requests\UpdateRecordRequest;
use App\Http\Resources\RecordResource;
use App\Models\Field;
use App\Models\Record;
use App\Models\Table;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RecordController extends Controller
{
    public function __construct(
        private FieldTypeRegistry $fieldTypeRegistry
    ) {}

    public function index(Request $request): JsonResponse
    {
        $tableId = $request->query('table_id');
        $query = Record::query();

        if ($tableId) {
            $query->where('table_id', $tableId);
        }

        return response()->json(RecordResource::collection($query->latest()->get()));
    }

    public function store(StoreRecordRequest $request): JsonResponse
    {
        $table = Table::findOrFail($request->validated()['table_id']);
        $data = $request->validated()['data'];

        // Validate against field-type registry
        $validationResult = $this->validateRecordData($table, $data);
        if (!$validationResult['valid']) {
            return response()->json([
                'error' => 'Validation failed',
                'errors' => $validationResult['errors'],
            ], 422);
        }

        $record = Record::create([
            'table_id' => $table->id,
            'data' => $this->normalizeRecordData($table, $data),
            'version' => 1,
        ]);

        return response()->json(new RecordResource($record), 201);
    }

    public function show(Record $record): JsonResponse
    {
        return response()->json(new RecordResource($record));
    }

    public function update(UpdateRecordRequest $request, Record $record): JsonResponse
    {
        $data = $request->validated()['data'];
        $table = $record->table;

        // Validate against field-type registry
        $validationResult = $this->validateRecordData($table, $data);
        if (!$validationResult['valid']) {
            return response()->json([
                'error' => 'Validation failed',
                'errors' => $validationResult['errors'],
            ], 422);
        }

        $record->update([
            'data' => $this->normalizeRecordData($table, $data),
            'version' => $record->version + 1,
        ]);

        return response()->json(new RecordResource($record));
    }

    public function destroy(Record $record): JsonResponse
    {
        $record->delete();

        return response()->json(null, 204);
    }

    private function validateRecordData(Table $table, array $data): array
    {
        $errors = [];
        $fields = $table->fields;
        $fieldMap = $fields->keyBy('name');

        // Check for unknown fields
        foreach (array_keys($data) as $fieldName) {
            if (!isset($fieldMap[$fieldName])) {
                $errors[$fieldName][] = 'Unknown field';
            }
        }

        // Validate each field
        foreach ($fields as $field) {
            $fieldName = $field->name;
            $value = $data[$fieldName] ?? null;

            $fieldType = $this->fieldTypeRegistry->get($field->type);
            $options = $field->options ?? [];

            $result = $fieldType->validate($value, $options);
            if (!$result['valid']) {
                $errors[$fieldName][] = $result['error'];
            }
        }

        return [
            'valid' => empty($errors),
            'errors' => $errors,
        ];
    }

    private function normalizeRecordData(Table $table, array $data): array
    {
        $normalized = [];
        $fields = $table->fields;
        $fieldMap = $fields->keyBy('name');

        foreach ($data as $fieldName => $value) {
            if (isset($fieldMap[$fieldName])) {
                $field = $fieldMap[$fieldName];
                $fieldType = $this->fieldTypeRegistry->get($field->type);
                $options = $field->options ?? [];

                $normalized[$fieldName] = $fieldType->serialize($value, $options);
            }
        }

        return $normalized;
    }
}
