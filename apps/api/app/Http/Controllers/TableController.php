<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreTableRequest;
use App\Http\Requests\UpdateTableRequest;
use App\Http\Resources\TableResource;
use App\Models\Table;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TableController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $databaseId = $request->query('database_id');
        $query = Table::query();

        if ($databaseId) {
            $query->where('database_id', $databaseId);
        }

        return response()->json(TableResource::collection($query->get()));
    }

    public function store(StoreTableRequest $request): JsonResponse
    {
        $table = Table::create($request->validated());

        return response()->json(new TableResource($table), 201);
    }

    public function show(Table $table): JsonResponse
    {
        return response()->json(new TableResource($table));
    }

    public function update(UpdateTableRequest $request, Table $table): JsonResponse
    {
        $table->update($request->validated());

        return response()->json(new TableResource($table));
    }

    public function destroy(Table $table): JsonResponse
    {
        $table->delete();

        return response()->json(null, 204);
    }
}
