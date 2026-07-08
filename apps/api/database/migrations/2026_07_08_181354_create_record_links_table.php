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
        Schema::create('record_links', function (Blueprint $table) {
            $table->ulid('from_record');
            $table->uuid('field_id');
            $table->ulid('to_record');
            
            $table->foreign('from_record')->references('id')->on('records')->onDelete('cascade');
            $table->foreign('field_id')->references('id')->on('fields')->onDelete('cascade');
            $table->foreign('to_record')->references('id')->on('records')->onDelete('cascade');
            
            $table->timestamps();
            
            // Unique constraint to prevent duplicate links
            $table->unique(['from_record', 'field_id', 'to_record'], 'record_links_unique');
            
            // Indexes for reverse lookups
            $table->index('to_record', 'record_links_to_record_index');
            $table->index('field_id', 'record_links_field_id_index');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('record_links');
    }
};
