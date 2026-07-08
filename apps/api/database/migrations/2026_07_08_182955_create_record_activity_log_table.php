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
        Schema::create('record_activity_log', function (Blueprint $table) {
            $table->id();
            $table->ulid('record_id');
            $table->uuid('user_id');
            $table->string('action'); // create, update, delete, restore
            $table->jsonb('changes')->nullable(); // Field-level diff
            $table->timestamps();
            
            $table->foreign('record_id')->references('id')->on('records')->onDelete('cascade');
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            
            // Indexes for efficient querying
            $table->index('record_id', 'record_activity_log_record_id_index');
            $table->index('user_id', 'record_activity_log_user_id_index');
            $table->index('created_at', 'record_activity_log_created_at_index');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('record_activity_log');
    }
};
