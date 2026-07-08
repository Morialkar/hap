<?php

namespace App\Http\Controllers;

use App\Http\Resources\ViewResource;
use App\Models\View;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ViewController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $tableId = $request->query('table_id');
        $query = View::query();

        if ($tableId) {
            $query->where('table_id', $tableId);
        }

        return response()->json(ViewResource::collection($query->get()));
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'table_id' => 'required|uuid|exists:tables,id',
            'name' => 'required|string|max:255',
            'type' => 'required|string|in:list,card,map',
            'config' => 'nullable|array',
        ]);

        $view = View::create($validated);

        return response()->json(new ViewResource($view), 201);
    }

    public function show(View $view): JsonResponse
    {
        return response()->json(new ViewResource($view));
    }

    public function update(Request $request, View $view): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'type' => 'sometimes|required|string|in:list,card,map',
            'config' => 'nullable|array',
        ]);

        $view->update($validated);

        return response()->json(new ViewResource($view));
    }

    public function destroy(View $view): JsonResponse
    {
        $view->delete();

        return response()->json(null, 204);
    }
}
