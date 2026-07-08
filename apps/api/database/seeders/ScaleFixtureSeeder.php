<?php

namespace Database\Seeders;

use App\Models\Database;
use App\Models\Field;
use App\Models\Record;
use App\Models\Table;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ScaleFixtureSeeder extends Seeder
{
    public function run(): void
    {
        $recordCount = env('SCALE_RECORD_COUNT', 100000);
        
        $this->command->info('Creating scale fixture...');
        $this->command->info("Record count: {$recordCount}");

        // Create workspace and user
        $user = User::firstOrCreate(
            ['email' => 'scale-test@example.com'],
            [
                'id' => (string) Str::uuid(),
                'name' => 'Scale Test User',
                'password' => bcrypt('password'),
            ]
        );

        $workspace = Workspace::firstOrCreate(
            ['name' => 'Scale Test Workspace'],
            ['id' => (string) Str::uuid()]
        );

        WorkspaceMember::firstOrCreate([
            'user_id' => $user->id,
            'workspace_id' => $workspace->id,
        ], ['role' => 'owner']);

        $database = Database::firstOrCreate(
            ['name' => 'Scale Test Database'],
            [
                'id' => (string) Str::uuid(),
                'workspace_id' => $workspace->id,
                'locale' => 'fr-CA',
            ]
        );

        $table = Table::firstOrCreate(
            ['name' => 'Scale Test Table', 'database_id' => $database->id],
            ['id' => (string) Str::uuid()]
        );

        // Create 50 fields with various types
        $this->createFields($table);

        // Create records with realistic data
        $this->createRecords($table, $recordCount);

        $this->command->info('Scale fixture created successfully!');
    }

    private function createFields(Table $table): void
    {
        $fieldTypes = [
            ['name' => 'title', 'type' => 'text', 'options' => ['max_length' => 255]],
            ['name' => 'description', 'type' => 'long_text', 'options' => []],
            ['name' => 'year', 'type' => 'number', 'options' => ['min' => 1800, 'max' => 2024]],
            ['name' => 'rating', 'type' => 'number', 'options' => ['min' => 1, 'max' => 5, 'decimal' => true]],
            ['name' => 'is_published', 'type' => 'boolean', 'options' => []],
            ['name' => 'category', 'type' => 'select', 'options' => ['options' => ['Fiction', 'Non-Fiction', 'Poetry', 'Drama', 'Science']]],
            ['name' => 'tags', 'type' => 'select', 'options' => ['multi' => true, 'options' => ['Classic', 'Modern', 'Contemporary', 'Historical', 'Experimental']]],
            ['name' => 'author', 'type' => 'reference', 'options' => ['multi' => false, 'target_table' => $table->id]],
            ['name' => 'editors', 'type' => 'reference', 'options' => ['multi' => true, 'target_table' => $table->id]],
            ['name' => 'website', 'type' => 'url', 'options' => []],
            ['name' => 'email', 'type' => 'email', 'options' => []],
            ['name' => 'publication_date', 'type' => 'date', 'options' => ['precision' => 'full']],
            ['name' => 'birth_year', 'type' => 'date', 'options' => ['precision' => 'year']],
            ['name' => 'cover_image', 'type' => 'image', 'options' => []],
            ['name' => 'attachments', 'type' => 'file', 'options' => ['multi' => true]],
        ];

        // Add additional fields to reach 50
        for ($i = 14; $i < 50; $i++) {
            $fieldTypes[] = [
                'name' => 'field_' . $i,
                'type' => ['text', 'number', 'boolean', 'select', 'date'][array_rand(['text', 'number', 'boolean', 'select', 'date'])],
                'options' => $this->getOptionsForType($fieldTypes[$i]['type']),
            ];
        }

        foreach ($fieldTypes as $fieldData) {
            Field::firstOrCreate(
                ['name' => $fieldData['name'], 'table_id' => $table->id],
                [
                    'id' => (string) Str::uuid(),
                    'type' => $fieldData['type'],
                    'position' => count($table->fields) + 1,
                    'options' => $fieldData['options'],
                ]
            );
        }
    }

    private function getOptionsForType(string $type): array
    {
        return match ($type) {
            'text' => ['max_length' => 255],
            'number' => ['min' => 0, 'max' => 1000],
            'select' => ['multi' => false, 'options' => ['Option A', 'Option B', 'Option C']],
            'date' => ['precision' => 'full'],
            default => [],
        };
    }

    private function createRecords(Table $table, int $count): void
    {
        $this->command->info("Creating {$count} records...");

        $fields = $table->fields;
        $recordIds = [];

        // Disable trigger for faster bulk insert (PostgreSQL)
        if (DB::connection()->getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE records DISABLE TRIGGER records_search_vector_update');
        }

        // Create records in batches
        $batchSize = 100;
        $batches = ceil($count / $batchSize);

        for ($batch = 0; $batch < $batches; $batch++) {
            $currentBatchSize = min($batchSize, $count - ($batch * $batchSize));

            for ($i = 0; $i < $currentBatchSize; $i++) {
                $data = $this->generateRealisticData($fields, $recordIds);
                
                $record = Record::create([
                    'table_id' => $table->id,
                    'data' => $data,
                    'version' => 1,
                ]);
                
                $recordIds[] = $record->id;
            }

            if (($batch + 1) % 10 === 0) {
                $this->command->info("Created " . (($batch + 1) * $batchSize) . " records...");
            }
        }

        // Re-enable trigger (PostgreSQL)
        if (DB::connection()->getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE records ENABLE TRIGGER records_search_vector_update');
            // Note: Search vectors will be updated by the trigger on subsequent mutations
            // For performance testing, we skip bulk update to avoid text search configuration issues
        }

        // Skip record links for simpler seeder - can be added later if needed
        // $this->createRecordLinks($table, $recordIds);
    }

    private function generateRealisticData($fields, array $existingRecordIds): array
    {
        $data = [];
        $sampleTitles = ['The Great Adventure', 'Silent Echoes', 'Mountain Dreams', 'Ocean Whispers', 'Forest Secrets', 'City Lights', 'Desert Winds', 'River Flows', 'Starlight Journey', 'Moonlight Path'];
        $sampleDescriptions = [
            'A compelling story of adventure and discovery.',
            'An exploration of human nature and relationships.',
            'A journey through time and space.',
            'A tale of mystery and intrigue.',
            'An epic saga spanning generations.',
        ];

        foreach ($fields as $field) {
            $data[$field->name] = match ($field->type) {
                'text' => $this->generateText($field->options['max_length'] ?? 255),
                'long_text' => $sampleDescriptions[array_rand($sampleDescriptions)],
                'number' => $this->generateNumber($field->options),
                'boolean' => (bool) rand(0, 1),
                'select' => $this->generateSelect($field->options),
                'date' => $this->generateDate($field->options['precision'] ?? 'full'),
                'url' => 'https://example.com/' . Str::random(10),
                'email' => Str::random(10) . '@example.com',
                'image' => [
                    'path' => 'uploads/images/' . Str::random(10) . '.jpg',
                    'name' => 'image_' . Str::random(10) . '.jpg',
                    'size' => rand(100000, 5000000),
                ],
                'file' => $this->generateFiles(),
                'reference' => !empty($existingRecordIds) ? $existingRecordIds[array_rand($existingRecordIds)] : null,
                default => null,
            };
        }

        return $data;
    }

    private function generateText(int $maxLength): string
    {
        $words = ['The', 'quick', 'brown', 'fox', 'jumps', 'over', 'lazy', 'dog', 'time', 'flies', 'when', 'having', 'fun'];
        $text = '';
        while (strlen($text) < $maxLength) {
            $text .= $words[array_rand($words)] . ' ';
        }
        return substr(trim($text), 0, $maxLength);
    }

    private function generateNumber(array $options): int|float
    {
        $min = $options['min'] ?? 0;
        $max = $options['max'] ?? 100;
        $decimal = $options['decimal'] ?? false;
        
        $value = rand($min, $max);
        return $decimal ? $value / 10 : $value;
    }

    private function generateSelect(array $options): string|array
    {
        $selectOptions = $options['options'] ?? ['A', 'B', 'C'];
        $multi = $options['multi'] ?? false;
        
        if ($multi) {
            $count = rand(1, min(3, count($selectOptions)));
            return array_rand(array_flip($selectOptions), $count);
        }
        
        return $selectOptions[array_rand($selectOptions)];
    }

    private function generateDate(string $precision): string
    {
        $year = rand(1800, 2024);
        
        return match ($precision) {
            'year' => $year . '-00-00',
            'year-month' => $year . '-' . str_pad(rand(1, 12), 2, '0', STR_PAD_LEFT) . '-00',
            'full' => $year . '-' . str_pad(rand(1, 12), 2, '0', STR_PAD_LEFT) . '-' . str_pad(rand(1, 28), 2, '0', STR_PAD_LEFT),
            default => $year . '-00-00',
        };
    }

    private function generateFiles(): array
    {
        $files = [];
        $count = rand(1, 3);
        
        for ($i = 0; $i < $count; $i++) {
            $files[] = [
                'path' => 'uploads/files/' . Str::random(10) . '.pdf',
                'name' => 'file_' . Str::random(10) . '.pdf',
                'size' => rand(100000, 10000000),
            ];
        }
        
        return $files;
    }

    private function createRecordLinks(Table $table, array $recordIds): void
    {
        $this->command->info('Creating record links...');

        $referenceFields = $table->fields->where('type', 'reference');
        
        if ($referenceFields->isEmpty()) {
            return;
        }

        $links = [];
        $linkCount = min(count($recordIds) * 2, 50000); // Limit to 50k links

        for ($i = 0; $i < $linkCount; $i++) {
            $fromRecord = $recordIds[array_rand($recordIds)];
            $toRecord = $recordIds[array_rand($recordIds)];
            $field = $referenceFields->random();

            $links[] = [
                'from_record' => $fromRecord,
                'field_id' => $field->id,
                'to_record' => $toRecord,
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }

        DB::table('record_links')->insert($links);
    }
}
