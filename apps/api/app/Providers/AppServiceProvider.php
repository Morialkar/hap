<?php

namespace App\Providers;

use App\Models\Database;
use App\Models\Field;
use App\Models\Record;
use App\Models\Table;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Route::model('database', Database::class);
        Route::model('table', Table::class);
        Route::model('field', Field::class);
        Route::model('record', Record::class);

        // Custom binding for soft-deleted records
        Route::bind('recordWithTrashed', function ($value) {
            return Record::withTrashed()->findOrFail($value);
        });
    }
}
