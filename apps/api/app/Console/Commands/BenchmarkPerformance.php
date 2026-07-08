<?php

namespace App\Console\Commands;

use App\Models\Record;
use App\Models\Table;
use App\Services\RecordLinkService;
use App\Services\RecordQueryService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class BenchmarkPerformance extends Command
{
    protected $signature = 'app:benchmark-performance';
    protected $description = 'Benchmark performance of key operations';
    protected $iterations = 100;
    protected $warmupIterations = 10;

    public function handle()
    {
        $this->info('Starting performance benchmark...');
        $this->info('This will run ' . $this->iterations . ' iterations for each operation.');
        $this->newLine();

        // Get the scale test table
        $table = Table::where('name', 'Scale Test Table')->first();
        
        if (!$table) {
            $this->error('Scale Test Table not found. Run the scale seeder first: php artisan db:seed --class=ScaleFixtureSeeder');
            return 1;
        }

        $results = [];

        // Benchmark list operation
        $this->info('Benchmarking list operation...');
        $results['list'] = $this->benchmarkList($table);
        $this->newLine();

        // Benchmark search operation
        $this->info('Benchmarking search operation...');
        $results['search'] = $this->benchmarkSearch($table);
        $this->newLine();

        // Benchmark single-record read
        $this->info('Benchmarking single-record read...');
        $results['read'] = $this->benchmarkRead($table);
        $this->newLine();

        // Benchmark reference reverse-lookup
        $this->info('Benchmarking reference reverse-lookup...');
        $results['reverse_lookup'] = $this->benchmarkReverseLookup($table);
        $this->newLine();

        // Display results
        $this->displayResults($results);

        // Generate report
        $this->generateReport($results);

        return 0;
    }

    private function benchmarkList(Table $table): array
    {
        $service = app(RecordQueryService::class);
        $latencies = [];

        // Warmup
        for ($i = 0; $i < $this->warmupIterations; $i++) {
            $service->queryRecords($table, ['per_page' => 20]);
        }

        // Actual benchmark
        for ($i = 0; $i < $this->iterations; $i++) {
            $start = microtime(true);
            $service->queryRecords($table, ['per_page' => 20]);
            $latencies[] = (microtime(true) - $start) * 1000; // Convert to ms
        }

        return $this->calculateStats($latencies, 200); // Target: 200ms
    }

    private function benchmarkSearch(Table $table): array
    {
        $service = app(RecordQueryService::class);
        $latencies = [];

        // Warmup
        for ($i = 0; $i < $this->warmupIterations; $i++) {
            $service->queryRecords($table, ['search' => 'adventure', 'per_page' => 20]);
        }

        // Actual benchmark
        for ($i = 0; $i < $this->iterations; $i++) {
            $start = microtime(true);
            $service->queryRecords($table, ['search' => 'adventure', 'per_page' => 20]);
            $latencies[] = (microtime(true) - $start) * 1000;
        }

        return $this->calculateStats($latencies, 200); // Target: 200ms
    }

    private function benchmarkRead(Table $table): array
    {
        $latencies = [];
        $record = Record::where('table_id', $table->id)->first();

        if (!$record) {
            $this->error('No records found in table');
            return [];
        }

        // Warmup
        for ($i = 0; $i < $this->warmupIterations; $i++) {
            Record::find($record->id);
        }

        // Actual benchmark
        for ($i = 0; $i < $this->iterations; $i++) {
            $start = microtime(true);
            Record::find($record->id);
            $latencies[] = (microtime(true) - $start) * 1000;
        }

        return $this->calculateStats($latencies, 50); // Target: 50ms
    }

    private function benchmarkReverseLookup(Table $table): array
    {
        $service = app(RecordLinkService::class);
        $latencies = [];
        $record = Record::where('table_id', $table->id)->first();

        if (!$record) {
            $this->error('No records found in table');
            return [];
        }

        // Warmup
        for ($i = 0; $i < $this->warmupIterations; $i++) {
            $service->getReferencingRecords($record, 1, 20);
        }

        // Actual benchmark
        for ($i = 0; $i < $this->iterations; $i++) {
            $start = microtime(true);
            $service->getReferencingRecords($record, 1, 20);
            $latencies[] = (microtime(true) - $start) * 1000;
        }

        return $this->calculateStats($latencies, 100); // Target: 100ms
    }

    private function calculateStats(array $latencies, int $target): array
    {
        sort($latencies);
        $count = count($latencies);
        
        $mean = array_sum($latencies) / $count;
        $min = $latencies[0];
        $max = $latencies[$count - 1];
        
        // Calculate p95
        $p95Index = (int) floor(0.95 * $count);
        $p95 = $latencies[$p95Index];
        
        // Calculate p99
        $p99Index = (int) floor(0.99 * $count);
        $p99 = $latencies[$p99Index];

        $passed = $p95 < $target;

        return [
            'mean' => round($mean, 2),
            'min' => round($min, 2),
            'max' => round($max, 2),
            'p95' => round($p95, 2),
            'p99' => round($p99, 2),
            'target' => $target,
            'passed' => $passed,
        ];
    }

    private function displayResults(array $results): void
    {
        $this->info('=== Performance Benchmark Results ===');
        $this->newLine();

        foreach ($results as $operation => $stats) {
            if (empty($stats)) {
                continue;
            }

            $status = $stats['passed'] ? '✓ PASS' : '✗ FAIL';
            $this->info("{$operation}:");
            $this->line("  Mean:   {$stats['mean']} ms");
            $this->line("  Min:    {$stats['min']} ms");
            $this->line("  Max:    {$stats['max']} ms");
            $this->line("  P95:    {$stats['p95']} ms (target: {$stats['target']} ms)");
            $this->line("  P99:    {$stats['p99']} ms");
            $this->line("  Status: {$status}");
            $this->newLine();
        }
    }

    private function generateReport(array $results): void
    {
        $reportPath = base_path('docs/PERFORMANCE.md');
        $content = "# Performance Benchmark Report\n\n";
        $content .= "Generated: " . now()->toDateTimeString() . "\n\n";
        $content .= "## Test Environment\n\n";
        $content .= "- Database: " . DB::connection()->getDriverName() . "\n";
        $content .= "- Records: 100,000\n";
        $content .= "- Fields: 50\n";
        $content .= "- Iterations: {$this->iterations}\n\n";
        $content .= "## Results\n\n";

        foreach ($results as $operation => $stats) {
            if (empty($stats)) {
                continue;
            }

            $status = $stats['passed'] ? '✓ PASS' : '✗ FAIL';
            $content .= "### {$operation}\n\n";
            $content .= "| Metric | Value | Target | Status |\n";
            $content .= "|--------|-------|--------|--------|\n";
            $content .= "| Mean | {$stats['mean']} ms | - | - |\n";
            $content .= "| Min | {$stats['min']} ms | - | - |\n";
            $content .= "| Max | {$stats['max']} ms | - | - |\n";
            $content .= "| P95 | {$stats['p95']} ms | {$stats['target']} ms | {$status} |\n";
            $content .= "| P99 | {$stats['p99']} ms | - | - |\n\n";
        }

        $content .= "## Recommendations\n\n";

        $allPassed = true;
        foreach ($results as $stats) {
            if (!empty($stats) && !$stats['passed']) {
                $allPassed = false;
                break;
            }
        }

        if ($allPassed) {
            $content .= "All performance targets met. No immediate tuning required.\n";
        } else {
            $content .= "Some performance targets were not met. Consider the following:\n\n";
            $content .= "- Review database indexes\n";
            $content .= "- Optimize queries with N+1 problems\n";
            $content .= "- Consider query result caching\n";
            $content .= "- Evaluate database connection pooling\n";
        }

        // Ensure docs directory exists
        if (!is_dir(base_path('docs'))) {
            mkdir(base_path('docs'), 0755, true);
        }

        file_put_contents($reportPath, $content);
        $this->info("Report generated at: {$reportPath}");
    }
}
