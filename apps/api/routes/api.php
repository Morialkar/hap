<?php

use App\Http\Controllers\DatabaseController;
use App\Http\Controllers\FieldController;
use App\Http\Controllers\RecordController;
use App\Http\Controllers\TableController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::get('/ping', function () {
        return response()->json([
            'status' => 'ok',
            'service' => 'Heritage Archives Patrimoine API',
            'version' => '1',
        ]);
    });

    Route::apiResource('databases', DatabaseController::class);
    Route::apiResource('tables', TableController::class);
    Route::apiResource('fields', FieldController::class);
    
    // Record routes - defined explicitly to avoid conflicts
    Route::get('records/trash', [RecordController::class, 'trash']);
    Route::get('records', [RecordController::class, 'index']);
    Route::post('records', [RecordController::class, 'store']);
    Route::get('records/{record}', [RecordController::class, 'show']);
    Route::put('records/{record}', [RecordController::class, 'update']);
    Route::delete('records/{record}', [RecordController::class, 'destroy']);
    Route::get('records/{record}/referencing-records', [RecordController::class, 'referencingRecords']);
    Route::post('records/{record}/reassign-links', [RecordController::class, 'reassignLinks']);
    Route::get('records/{record}/history', [RecordController::class, 'history']);
    Route::post('records/{record}/restore-version', [RecordController::class, 'restoreVersion']);
    Route::post('records/{recordWithTrashed}/restore', [RecordController::class, 'restore']);
    Route::delete('records/{recordWithTrashed}/purge', [RecordController::class, 'purge']);
    
    Route::get('fields/{field}/preview-impact', [FieldController::class, 'previewImpact']);
    Route::get('fields/{field}/confirmation-token', [FieldController::class, 'generateConfirmationToken']);
});

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');
