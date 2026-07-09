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
        Schema::table('templates', function (Blueprint $table) {
            $table->string('description')->nullable()->after('name');
            $table->unsignedSmallInteger('format_version')->default(1)->after('description');
            $table->string('template_version')->default('1.0.0')->after('format_version');
            $table->json('payload')->nullable()->after('schema');
            $table->foreignUuid('source_database_id')->nullable()->after('database_id')->constrained('databases')->nullOnDelete();
            $table->boolean('includes_demo_records')->default(false)->after('payload');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('templates', function (Blueprint $table) {
            $table->dropForeign(['source_database_id']);
            $table->dropColumn([
                'description',
                'format_version',
                'template_version',
                'payload',
                'source_database_id',
                'includes_demo_records',
            ]);
        });
    }
};
