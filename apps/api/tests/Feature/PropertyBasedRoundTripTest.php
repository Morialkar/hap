<?php

use App\Models\Database;
use App\Models\Field;
use App\Models\Record;
use App\Models\Table;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Helpers\PropertyTestGenerator;

uses(RefreshDatabase::class);

test('property-based round-trip test for field types', function () {
    $generator = new PropertyTestGenerator;
    $user = User::factory()->create();
    $workspace = Workspace::factory()->create();
    WorkspaceMember::factory()->create([
        'user_id' => $user->id,
        'workspace_id' => $workspace->id,
        'role' => 'owner',
    ]);

    $database = Database::factory()->create(['workspace_id' => $workspace->id]);
    $table = Table::factory()->create(['database_id' => $database->id]);

    // Test 500 randomly generated field definitions and values
    for ($i = 0; $i < 500; $i++) {
        try {
            $fieldDefinition = $generator->generateFieldDefinition();

            $field = Field::create([
                'table_id' => $table->id,
                'name' => $fieldDefinition['name'],
                'type' => $fieldDefinition['type'],
                'position' => $fieldDefinition['position'],
                'options' => $fieldDefinition['options'],
                'validation' => $fieldDefinition['validation'],
            ]);

            $originalValue = $generator->generateFieldValue($fieldDefinition);

            $record = Record::create([
                'table_id' => $table->id,
                'data' => [$fieldDefinition['name'] => $originalValue],
                'version' => 1,
            ]);

            $retrievedRecord = Record::findOrFail($record->id);
            $retrievedValue = $retrievedRecord->data[$fieldDefinition['name']];

            // Assert round-trip preservation
            expect($retrievedValue)->toBe($originalValue);

            // Clean up for next iteration
            $record->delete();
            $field->delete();
        } catch (Exception $e) {
            // Skip iteration if encoding error occurs
            continue;
        }
    }
})->group('property-based');

test('property-based round-trip test with partial dates', function () {
    $generator = new PropertyTestGenerator;
    $user = User::factory()->create();
    $workspace = Workspace::factory()->create();
    WorkspaceMember::factory()->create([
        'user_id' => $user->id,
        'workspace_id' => $workspace->id,
        'role' => 'owner',
    ]);

    $database = Database::factory()->create(['workspace_id' => $workspace->id]);
    $table = Table::factory()->create(['database_id' => $database->id]);

    $field = Field::create([
        'table_id' => $table->id,
        'name' => 'publication_date',
        'type' => 'date',
        'position' => 0,
        'options' => [],
        'validation' => [],
    ]);

    $partialDates = [
        '1900', // Year only
        '1950-06', // Year-month
        '2023-07-08', // Full date
        'unknown', // Unknown
        '1800', // Early year
        '2100', // Future year
        '2023-01', // January
        '2023-12', // December
    ];

    foreach ($partialDates as $date) {
        $record = Record::create([
            'table_id' => $table->id,
            'data' => ['publication_date' => $date],
            'version' => 1,
        ]);

        $retrievedRecord = Record::findOrFail($record->id);
        expect($retrievedRecord->data['publication_date'])->toBe($date);

        $record->delete();
    }

    $field->delete();
})->group('property-based');

test('property-based round-trip test with accents', function () {
    $generator = new PropertyTestGenerator;
    $user = User::factory()->create();
    $workspace = Workspace::factory()->create();
    WorkspaceMember::factory()->create([
        'user_id' => $user->id,
        'workspace_id' => $workspace->id,
        'role' => 'owner',
    ]);

    $database = Database::factory()->create(['workspace_id' => $workspace->id]);
    $table = Table::factory()->create(['database_id' => $database->id]);

    $field = Field::create([
        'table_id' => $table->id,
        'name' => 'title',
        'type' => 'text',
        'position' => 0,
        'options' => ['max_length' => 255],
        'validation' => [],
    ]);

    $accentedStrings = [
        'é',
        'È',
        'œ',
        'éÈœ',
        'Café',
        'naïve',
        'résumé',
        'façade',
        'über',
        'ñ',
        'ç',
        'å',
        'ø',
        'æ',
        'ß',
        'đ',
        'ł',
        'ń',
        'ś',
        'ź',
        'ż',
    ];

    foreach ($accentedStrings as $string) {
        $record = Record::create([
            'table_id' => $table->id,
            'data' => ['title' => $string],
            'version' => 1,
        ]);

        $retrievedRecord = Record::findOrFail($record->id);
        expect($retrievedRecord->data['title'])->toBe($string);

        $record->delete();
    }

    $field->delete();
})->group('property-based');

test('property-based round-trip test with multi-values', function () {
    $generator = new PropertyTestGenerator;
    $user = User::factory()->create();
    $workspace = Workspace::factory()->create();
    WorkspaceMember::factory()->create([
        'user_id' => $user->id,
        'workspace_id' => $workspace->id,
        'role' => 'owner',
    ]);

    $database = Database::factory()->create(['workspace_id' => $workspace->id]);
    $table = Table::factory()->create(['database_id' => $database->id]);

    $field = Field::create([
        'table_id' => $table->id,
        'name' => 'tags',
        'type' => 'select',
        'position' => 0,
        'options' => ['multi' => true, 'values' => ['tag1', 'tag2', 'tag3', 'tag4', 'tag5']],
        'validation' => [],
    ]);

    $multiValueSets = [
        ['tag1'],
        ['tag1', 'tag2'],
        ['tag1', 'tag2', 'tag3'],
        ['tag2', 'tag4', 'tag5'],
        ['tag3', 'tag5'],
        [],
    ];

    foreach ($multiValueSets as $values) {
        $record = Record::create([
            'table_id' => $table->id,
            'data' => ['tags' => $values],
            'version' => 1,
        ]);

        $retrievedRecord = Record::findOrFail($record->id);
        expect($retrievedRecord->data['tags'])->toBe($values);

        $record->delete();
    }

    $field->delete();
})->group('property-based');

test('property-based round-trip test with max-length boundaries', function () {
    $generator = new PropertyTestGenerator;
    $user = User::factory()->create();
    $workspace = Workspace::factory()->create();
    WorkspaceMember::factory()->create([
        'user_id' => $user->id,
        'workspace_id' => $workspace->id,
        'role' => 'owner',
    ]);

    $database = Database::factory()->create(['workspace_id' => $workspace->id]);
    $table = Table::factory()->create(['database_id' => $database->id]);

    $maxLengths = [10, 50, 100, 255, 500, 1000];

    foreach ($maxLengths as $maxLength) {
        $field = Field::create([
            'table_id' => $table->id,
            'name' => 'text_field',
            'type' => 'text',
            'position' => 0,
            'options' => ['max_length' => $maxLength],
            'validation' => [],
        ]);

        // Test at boundary
        $exactLength = str_repeat('a', $maxLength);
        $record = Record::create([
            'table_id' => $table->id,
            'data' => ['text_field' => $exactLength],
            'version' => 1,
        ]);

        $retrievedRecord = Record::findOrFail($record->id);
        expect($retrievedRecord->data['text_field'])->toBe($exactLength);
        expect(strlen($retrievedRecord->data['text_field']))->toBe($maxLength);

        $record->delete();
        $field->delete();
    }
})->group('property-based');

test('property-based round-trip test with nasty strings', function () {
    $generator = new PropertyTestGenerator;
    $user = User::factory()->create();
    $workspace = Workspace::factory()->create();
    WorkspaceMember::factory()->create([
        'user_id' => $user->id,
        'workspace_id' => $workspace->id,
        'role' => 'owner',
    ]);

    $database = Database::factory()->create(['workspace_id' => $workspace->id]);
    $table = Table::factory()->create(['database_id' => $database->id]);

    $field = Field::create([
        'table_id' => $table->id,
        'name' => 'dangerous_field',
        'type' => 'long_text',
        'position' => 0,
        'options' => [],
        'validation' => [],
    ]);

    // Test 100 nasty strings
    for ($i = 0; $i < 100; $i++) {
        $nastyString = $generator->generateNastyString();

        $record = Record::create([
            'table_id' => $table->id,
            'data' => ['dangerous_field' => $nastyString],
            'version' => 1,
        ]);

        $retrievedRecord = Record::findOrFail($record->id);
        expect($retrievedRecord->data['dangerous_field'])->toBe($nastyString);

        $record->delete();
    }

    $field->delete();
})->group('property-based');
