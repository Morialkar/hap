<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreFieldRequest;
use App\Http\Requests\UpdateFieldRequest;
use App\Http\Resources\FieldResource;
use App\Models\Field;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FieldController extends Controller
{
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

    public function destroy(Field $field): JsonResponse
    {
        $field->delete();

        return response()->json(null, 204);
    }
}
