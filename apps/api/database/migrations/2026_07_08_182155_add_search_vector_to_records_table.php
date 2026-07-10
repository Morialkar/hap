<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            Schema::table('records', function (Blueprint $table) {
                $table->tsvector('search_vector')->nullable();
            });

            // Add GIN index for efficient full-text search
            DB::statement('CREATE INDEX records_search_vector_idx ON records USING GIN(search_vector)');

            // Create trigger to automatically update search_vector on data changes
            DB::statement("
                CREATE TRIGGER records_search_vector_update 
                BEFORE INSERT OR UPDATE ON records 
                FOR EACH ROW 
                EXECUTE FUNCTION tsvector_update_trigger(search_vector, 'pg_catalog.english', data)
            ");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('DROP TRIGGER IF EXISTS records_search_vector_update ON records');
            DB::statement('DROP INDEX IF EXISTS records_search_vector_idx');

            Schema::table('records', function (Blueprint $table) {
                $table->dropColumn('search_vector');
            });
        }
    }
};
