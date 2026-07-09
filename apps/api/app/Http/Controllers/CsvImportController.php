<?php

namespace App\Http\Controllers;

use App\Http\Requests\CsvImportRequest;
use App\Models\Table;
use App\Services\CsvImportService;
use Illuminate\Http\JsonResponse;

class CsvImportController extends Controller
{
    public function __construct(private CsvImportService $csvImportService) {}

    public function dryRun(CsvImportRequest $request, Table $table): JsonResponse
    {
        $result = $this->csvImportService->dryRun(
            $table,
            $request->file('file'),
            $request->input('mapping')
        );

        return response()->json($result);
    }

    public function import(CsvImportRequest $request, Table $table): JsonResponse
    {
        $result = $this->csvImportService->import(
            $table,
            $request->file('file'),
            $request->input('mapping'),
            $request->user()
        );

        return response()->json($result, 201);
    }
}
