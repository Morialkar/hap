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
        Schema::create('fields', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('table_id')->constrained()->onDelete('cascade');
            $table->string('type'); // text, number, date, boolean, select, reference, etc.
            $table->string('name');
            $table->integer('position')->default(0);
            $table->json('options')->nullable(); // field-type-specific options
            $table->json('validation')->nullable(); // validation rules
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('fields');
    }
};
