<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreDatabaseRequest;
use App\Http\Requests\UpdateDatabaseRequest;
use App\Http\Resources\DatabaseResource;
use App\Models\Database;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DatabaseController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $workspaceId = $request->query('workspace_id');
        $query = Database::query();

        if ($workspaceId) {
            $query->where('workspace_id', $workspaceId);
        }

        return response()->json(DatabaseResource::collection($query->get()));
    }

    public function store(StoreDatabaseRequest $request): JsonResponse
    {
        $database = Database::create($request->validated());

        return response()->json(new DatabaseResource($database), 201);
    }

    public function show(Database $database): JsonResponse
    {
        return response()->json(new DatabaseResource($database));
    }

    public function update(UpdateDatabaseRequest $request, Database $database): JsonResponse
    {
        $database->update($request->validated());

        return response()->json(new DatabaseResource($database));
    }

    public function destroy(Database $database): JsonResponse
    {
        $database->delete();

        return response()->json(null, 204);
    }
}
