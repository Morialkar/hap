<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('records', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->uuid('table_id');
            $table->foreign('table_id')->references('id')->on('tables')->onDelete('cascade');

            $table->jsonb('data');
            $table->bigInteger('version')->default(1);

            $table->timestamps();
            $table->softDeletes();

            // GIN index for JSONB queries
            $table->index('data', 'records_data_gin', 'gin');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('records');
    }
};
