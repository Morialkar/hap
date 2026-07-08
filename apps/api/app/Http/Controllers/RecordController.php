<?php

namespace App\Http\Controllers;

use App\FieldTypes\FieldTypeRegistry;
use App\Http\Requests\StoreRecordRequest;
use App\Http\Requests\UpdateRecordRequest;
use App\Http\Resources\RecordResource;
use App\Models\Field;
use App\Models\Record;
use App\Models\Table;
use App\Services\RecordLinkService;
use App\Services\RecordQueryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RecordController extends Controller
{
    public function __construct(
        private FieldTypeRegistry $fieldTypeRegistry,
        private RecordLinkService $recordLinkService,
        private RecordQueryService $recordQueryService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $tableId = $request->query('table_id');
        
        if (!$tableId) {
            return response()->json([
                'error' => 'table_id parameter is required',
            ], 400);
        }

        $table = Table::findOrFail($tableId);

        $params = [
            'search' => $request->query('search'),
            'filters' => $request->query('filters') ? json_decode($request->query('filters'), true) : [],
            'sort' => $request->query('sort'),
            'sort_dir' => $request->query('sort_dir', 'asc'),
            'per_page' => $request->query('per_page', 20),
            'cursor' => $request->query('cursor'),
        ];

        $result = $this->recordQueryService->queryRecords($table, $params);

        return response()->json([
            'data' => RecordResource::collection($result['data']),
            'pagination' => $result['pagination'],
        ]);
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

        // Sync record links for reference fields
        $this->recordLinkService->syncLinks($record);

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

        // Sync record links for reference fields
        $this->recordLinkService->syncLinks($record);

        return response()->json(new RecordResource($record));
    }

    public function destroy(Record $record): JsonResponse
    {
        // Check if record is referenced by other records
        $referenceCounts = $this->recordLinkService->getReferenceCounts($record);
        
        if ($referenceCounts['total'] > 0) {
            return response()->json([
                'error' => 'Cannot delete record that is referenced by other records',
                'reference_counts' => $referenceCounts,
            ], 409);
        }

        $record->delete();

        return response()->json(null, 204);
    }

    public function referencingRecords(Request $request, Record $record): JsonResponse
    {
        $page = $request->query('page', 1);
        $perPage = $request->query('per_page', 20);

        $result = $this->recordLinkService->getReferencingRecords($record, $page, $perPage);

        return response()->json($result);
    }

    public function reassignLinks(Request $request, Record $record): JsonResponse
    {
        $toRecordId = $request->input('to_record_id');
        $toRecord = Record::findOrFail($toRecordId);

        $this->recordLinkService->reassignLinks($record, $toRecord);

        return response()->json([
            'message' => 'Links reassigned successfully',
            'from_record' => $record->id,
            'to_record' => $toRecord->id,
        ]);
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
