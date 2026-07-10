<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('DROP TRIGGER IF EXISTS records_search_vector_update ON records');

            DB::statement("
                CREATE OR REPLACE FUNCTION records_search_vector_update_fn()
                RETURNS TRIGGER AS $$
                BEGIN
                    NEW.search_vector := jsonb_to_tsvector('pg_catalog.english', NEW.data, '[\"string\"]');
                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;
            ");

            DB::statement('
                CREATE TRIGGER records_search_vector_update 
                BEFORE INSERT OR UPDATE ON records 
                FOR EACH ROW 
                EXECUTE FUNCTION records_search_vector_update_fn()
            ');
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('DROP TRIGGER IF EXISTS records_search_vector_update ON records');
            DB::statement('DROP FUNCTION IF EXISTS records_search_vector_update_fn()');

            DB::statement("
                CREATE TRIGGER records_search_vector_update 
                BEFORE INSERT OR UPDATE ON records 
                FOR EACH ROW 
                EXECUTE FUNCTION tsvector_update_trigger(search_vector, 'pg_catalog.english', data)
            ");
        }
    }
};
