<?php

use App\Http\Controllers\DatabaseController;
use App\Http\Controllers\FieldController;
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
});

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');
