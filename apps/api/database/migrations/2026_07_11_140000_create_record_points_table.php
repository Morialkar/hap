<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('CREATE EXTENSION IF NOT EXISTS postgis');
        }

        Schema::create('record_points', function (Blueprint $table) {
            $table->ulid('record_id');
            $table->uuid('field_id');
            $table->decimal('latitude', 10, 7);
            $table->decimal('longitude', 10, 7);
            $table->timestamps();

            $table->foreign('record_id')->references('id')->on('records')->onDelete('cascade');
            $table->foreign('field_id')->references('id')->on('fields')->onDelete('cascade');
            $table->unique(['record_id', 'field_id'], 'record_points_unique');
            $table->index('field_id', 'record_points_field_id_index');
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE record_points ADD COLUMN geog geography(Point, 4326) NOT NULL');
            DB::statement('CREATE INDEX record_points_geog_index ON record_points USING GIST (geog)');
        } else {
            Schema::table('record_points', function (Blueprint $table) {
                $table->string('geog');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('record_points');
    }
};
