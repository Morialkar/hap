<?php

namespace App\Console\Commands;

use App\Models\Database;
use App\Services\RecordPointService;
use Illuminate\Console\Command;

class BackfillRecordPoints extends Command
{
    protected $signature = 'records:backfill-points {database? : Database UUID; omit to backfill every database}';

    protected $description = 'Build PostGIS record point indexes from existing GPS values';

    public function handle(RecordPointService $recordPointService): int
    {
        $databases = Database::query()
            ->when($this->argument('database'), fn ($query, $id) => $query->whereKey($id))
            ->get();

        foreach ($databases as $database) {
            $count = $recordPointService->backfillDatabase($database);
            $this->line("Indexed {$count} records for {$database->name}.");
        }

        return self::SUCCESS;
    }
}
