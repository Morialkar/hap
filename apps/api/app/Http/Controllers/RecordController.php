<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreRecordRequest;
use App\Http\Requests\UpdateRecordRequest;
use App\Http\Resources\RecordResource;
use App\Models\Record;
use App\Models\RecordActivityLog;
use App\Models\Table;
use App\Services\RecordActivityService;
use App\Services\RecordLinkService;
use App\Services\RecordQueryService;
use App\Services\RecordValidationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RecordController extends Controller
{
    public function __construct(
        private RecordLinkService $recordLinkService,
        private RecordQueryService $recordQueryService,
        private RecordActivityService $recordActivityService,
        private RecordValidationService $recordValidationService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $tableId = $request->query('table_id');

        if (! $tableId) {
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
        $validationResult = $this->recordValidationService->validate($table, $data);
        if (! $validationResult['valid']) {
            return response()->json([
                'error' => 'Validation failed',
                'errors' => $validationResult['errors'],
            ], 422);
        }

        $record = Record::create([
            'table_id' => $table->id,
            'data' => $this->recordValidationService->normalize($table, $data),
            'version' => 1,
        ]);

        // Sync record links for reference fields
        $this->recordLinkService->syncLinks($record);

        // Log activity
        $this->recordActivityService->logCreate($record, $request->user());

        return response()->json(new RecordResource($record), 201);
    }

    public function show(Record $record): JsonResponse
    {
        return response()->json(new RecordResource($record));
    }

    public function update(UpdateRecordRequest $request, Record $record): JsonResponse
    {
        $data = $request->validated()['data'];
        $table = Table::findOrFail($record->table_id);

        // Optimistic concurrency check
        $clientVersion = $request->input('version');
        if ($clientVersion !== null && $record->version != $clientVersion) {
            return response()->json([
                'error' => 'Record has been modified by another user',
                'current_version' => $record->version,
                'client_version' => $clientVersion,
            ], 409);
        }

        // Validate against field-type registry
        $validationResult = $this->recordValidationService->validate($table, $data);
        if (! $validationResult['valid']) {
            return response()->json([
                'error' => 'Validation failed',
                'errors' => $validationResult['errors'],
            ], 422);
        }

        $oldData = $record->data;
        $newData = $this->recordValidationService->normalize($table, $data);

        $record->update([
            'data' => $newData,
            'version' => $record->version + 1,
        ]);

        // Sync record links for reference fields
        $this->recordLinkService->syncLinks($record);

        // Log activity with diff
        $this->recordActivityService->logUpdate($record, $request->user(), $oldData, $newData);

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

        // Log activity
        $this->recordActivityService->logDelete($record, request()->user());

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

    public function history(Request $request, Record $record): JsonResponse
    {
        $page = $request->query('page', 1);
        $perPage = $request->query('per_page', 20);

        $result = $this->recordActivityService->getHistory($record, $page, $perPage);

        return response()->json($result);
    }

    public function restoreVersion(Request $request, Record $record): JsonResponse
    {
        $logId = $request->input('log_id');
        $log = RecordActivityLog::findOrFail($logId);

        if ($log->record_id !== $record->id) {
            return response()->json([
                'error' => 'Log entry does not belong to this record',
            ], 400);
        }

        $oldData = $record->data;
        $newData = $log->changes['data'] ?? $log->changes['diff'] ?? [];

        $record->update([
            'data' => $newData,
            'version' => $record->version + 1,
        ]);

        // Sync record links for reference fields
        $this->recordLinkService->syncLinks($record);

        // Log restore activity
        $this->recordActivityService->logUpdate($record, $request->user(), $oldData, $newData);

        return response()->json(new RecordResource($record));
    }

    public function trash(Request $request): JsonResponse
    {
        $tableId = $request->query('table_id');
        $query = Record::onlyTrashed();

        if ($tableId) {
            $query->where('table_id', $tableId);
        }

        $perPage = $request->query('per_page', 20);
        $records = $query->latest('deleted_at')->paginate($perPage);

        return response()->json([
            'data' => RecordResource::collection($records->items()),
            'pagination' => [
                'current_page' => $records->currentPage(),
                'per_page' => $records->perPage(),
                'total' => $records->total(),
                'last_page' => $records->lastPage(),
            ],
        ]);
    }

    public function restore(Request $request, Record $recordWithTrashed): JsonResponse
    {
        $recordWithTrashed->restore();

        // Sync record links for reference fields
        $this->recordLinkService->syncLinks($recordWithTrashed);

        // Log restore activity
        $this->recordActivityService->logRestore($recordWithTrashed, $request->user());

        return response()->json(new RecordResource($recordWithTrashed));
    }

    public function purge(Request $request, Record $recordWithTrashed): JsonResponse
    {
        // Check if record is referenced by other records
        $referenceCounts = $this->recordLinkService->getReferenceCounts($recordWithTrashed);

        if ($referenceCounts['total'] > 0) {
            return response()->json([
                'error' => 'Cannot purge record that is referenced by other records',
                'reference_counts' => $referenceCounts,
            ], 409);
        }

        $recordWithTrashed->forceDelete();

        return response()->json(null, 204);
    }
}
