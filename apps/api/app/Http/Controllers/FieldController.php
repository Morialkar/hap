<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreFieldRequest;
use App\Http\Requests\UpdateFieldRequest;
use App\Http\Resources\FieldResource;
use App\Models\Field;
use App\Models\Table;
use App\Services\SchemaChangeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FieldController extends Controller
{
    public function __construct(
        private SchemaChangeService $schemaChangeService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $tableId = $request->query('table_id');
        $query = Field::query();

        if ($tableId) {
            $query->where('table_id', $tableId);
        }

        return response()->json(FieldResource::collection($query->orderBy('position')->get()));
    }

    public function store(StoreFieldRequest $request): JsonResponse
    {
        $field = Field::create($request->validated());

        return response()->json(new FieldResource($field), 201);
    }

    public function show(Field $field): JsonResponse
    {
        return response()->json(new FieldResource($field));
    }

    public function update(UpdateFieldRequest $request, Field $field): JsonResponse
    {
        $field->update($request->validated());

        return response()->json(new FieldResource($field));
    }

    public function destroy(Request $request, Field $field): JsonResponse
    {
        $table = $field->table;
        $isDestructive = $this->schemaChangeService->isDestructiveChange($field, ['_delete' => true]);

        if ($isDestructive) {
            $token = $request->input('confirmation_token');
            
            if (!$token || !$this->schemaChangeService->validateConfirmationToken($table, $token)) {
                $impact = $this->schemaChangeService->calculateDataImpact($field, ['_delete' => true]);
                
                return response()->json([
                    'error' => 'Destructive change requires confirmation',
                    'impact' => $impact,
                    'confirmation_token' => $this->schemaChangeService->generateConfirmationToken($table),
                ], 409);
            }

            // Retain orphaned values before deletion
            $this->schemaChangeService->retainOrphanedValues($field);

            // Record the schema change
            $this->schemaChangeService->recordChange(
                $table,
                'delete_field',
                [
                    'field_id' => $field->id,
                    'field_name' => $field->name,
                    'field_type' => $field->type,
                ],
                $request->user()->id
            );
        }

        $field->delete();

        return response()->json(null, 204);
    }

    public function previewImpact(Field $field): JsonResponse
    {
        $impact = $this->schemaChangeService->calculateDataImpact($field, ['_delete' => true]);

        return response()->json([
            'field_id' => $field->id,
            'field_name' => $field->name,
            'impact' => $impact,
        ]);
    }

    public function generateConfirmationToken(Field $field): JsonResponse
    {
        $table = $field->table;
        $token = $this->schemaChangeService->generateConfirmationToken($table);

        return response()->json([
            'token' => $token,
        ]);
    }
}
