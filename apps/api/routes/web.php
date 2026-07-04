<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/app-config', function () {
    return response()->json([
        'apiBase' => url('/api/v1'),
        'locale' => app()->getLocale(),
        'csrfToken' => csrf_token(),
    ]);
});
