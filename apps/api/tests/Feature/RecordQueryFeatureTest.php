<?php

use App\Models\Database;
use App\Models\Field;
use App\Models\Record;
use App\Models\Table;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

test('accent ordering with French collation', function () {
    // Skip on SQLite as it doesn't support ICU collations
    if (DB::connection()->getDriverName() === 'sqlite') {
        $this->markTestSkipped('ICU collations not supported on SQLite');
    }

    $user = User::factory()->create();
    $workspace = Workspace::factory()->create();
    WorkspaceMember::factory()->create([
        'user_id' => $user->id,
        'workspace_id' => $workspace->id,
        'role' => 'owner',
    ]);

    $database = Database::factory()->create([
        'workspace_id' => $workspace->id,
        'locale' => 'fr-CA',
    ]);
    $table = Table::factory()->create(['database_id' => $database->id]);
    
    Field::factory()->create([
        'table_id' => $table->id,
        'name' => 'name',
        'type' => 'text',
        'options' => ['max_length' => 255],
    ]);

    // Create records with accented names
    Record::factory()->create([
        'table_id' => $table->id,
        'data' => ['name' => 'Éthier'],
    ]);

    Record::factory()->create([
        'table_id' => $table->id,
        'data' => ['name' => 'Ethier'],
    ]);

    Record::factory()->create([
        'table_id' => $table->id,
        'data' => ['name' => 'Aubin'],
    ]);

    $response = $this->actingAs($user)
        ->getJson('/api/v1/records?table_id=' . $table->id . '&sort=name&sort_dir=asc');

    $response->assertStatus(200);
    
    $names = collect($response->json('data'))->pluck('data.name')->toArray();
    
    // With French collation, É should sort with E
    expect($names)->toBe(['Aubin', 'Ethier', 'Éthier']);
});

test('reference field filtering using record_links', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->create();
    WorkspaceMember::factory()->create([
        'user_id' => $user->id,
        'workspace_id' => $workspace->id,
        'role' => 'owner',
    ]);

    $database = Database::factory()->create(['workspace_id' => $workspace->id]);
    $table = Table::factory()->create(['database_id' => $database->id]);
    
    $referenceField = Field::factory()->create([
        'table_id' => $table->id,
        'name' => 'author',
        'type' => 'reference',
        'options' => ['multi' => false, 'target_table' => $table->id],
    ]);

    $author1 = Record::factory()->create(['table_id' => $table->id]);
    $author2 = Record::factory()->create(['table_id' => $table->id]);

    // Use API endpoint to create records with link sync
    $response1 = $this->actingAs($user)
        ->postJson('/api/v1/records', [
            'table_id' => $table->id,
            'data' => ['author' => $author1->id],
        ]);
    $book1Id = $response1->json('id');

    $response2 = $this->actingAs($user)
        ->postJson('/api/v1/records', [
            'table_id' => $table->id,
            'data' => ['author' => $author2->id],
        ]);
    $book2Id = $response2->json('id');

    $response3 = $this->actingAs($user)
        ->postJson('/api/v1/records', [
            'table_id' => $table->id,
            'data' => ['author' => $author1->id],
        ]);
    $book3Id = $response3->json('id');

    $filters = json_encode([[
        'field' => 'author',
        'operator' => 'eq',
        'value' => $author1->id,
    ]]);

    $response = $this->actingAs($user)
        ->getJson('/api/v1/records?table_id=' . $table->id . '&filters=' . urlencode($filters));

    $response->assertStatus(200);
    
    $recordIds = collect($response->json('data'))->pluck('id')->toArray();
    
    expect($recordIds)->toContain($book1Id);
    expect($recordIds)->toContain($book3Id);
    expect($recordIds)->not->toContain($book2Id);
});

test('full-text search across text fields', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->create();
    WorkspaceMember::factory()->create([
        'user_id' => $user->id,
        'workspace_id' => $workspace->id,
        'role' => 'owner',
    ]);

    $database = Database::factory()->create(['workspace_id' => $workspace->id]);
    $table = Table::factory()->create(['database_id' => $database->id]);
    
    Field::factory()->create([
        'table_id' => $table->id,
        'name' => 'title',
        'type' => 'text',
        'options' => ['max_length' => 255],
    ]);

    Field::factory()->create([
        'table_id' => $table->id,
        'name' => 'description',
        'type' => 'long_text',
    ]);

    Record::factory()->create([
        'table_id' => $table->id,
        'data' => [
            'title' => 'The Great Gatsby',
            'description' => 'A novel about the American Dream',
        ],
    ]);

    Record::factory()->create([
        'table_id' => $table->id,
        'data' => [
            'title' => 'To Kill a Mockingbird',
            'description' => 'A novel about racial injustice',
        ],
    ]);

    Record::factory()->create([
        'table_id' => $table->id,
        'data' => [
            'title' => '1984',
            'description' => 'A dystopian novel',
        ],
    ]);

    $response = $this->actingAs($user)
        ->getJson('/api/v1/records?table_id=' . $table->id . '&search=novel');

    $response->assertStatus(200);
    
    expect($response->json('data'))->toHaveCount(3);
});

test('cursor pagination works correctly', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->create();
    WorkspaceMember::factory()->create([
        'user_id' => $user->id,
        'workspace_id' => $workspace->id,
        'role' => 'owner',
    ]);

    $database = Database::factory()->create(['workspace_id' => $workspace->id]);
    $table = Table::factory()->create(['database_id' => $database->id]);
    
    Field::factory()->create([
        'table_id' => $table->id,
        'name' => 'title',
        'type' => 'text',
    ]);

    // Create 25 records
    for ($i = 1; $i <= 25; $i++) {
        Record::factory()->create([
            'table_id' => $table->id,
            'data' => ['title' => 'Record ' . $i],
        ]);
    }

    $response = $this->actingAs($user)
        ->getJson('/api/v1/records?table_id=' . $table->id . '&per_page=10');

    $response->assertStatus(200);
    
    expect($response->json('data'))->toHaveCount(10);
    expect($response->json('pagination.total'))->toBe(25);
    expect($response->json('pagination.next_cursor'))->not->toBeNull();
});

test('filter operators work correctly', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->create();
    WorkspaceMember::factory()->create([
        'user_id' => $user->id,
        'workspace_id' => $workspace->id,
        'role' => 'owner',
    ]);

    $database = Database::factory()->create(['workspace_id' => $workspace->id]);
    $table = Table::factory()->create(['database_id' => $database->id]);
    
    Field::factory()->create([
        'table_id' => $table->id,
        'name' => 'year',
        'type' => 'number',
    ]);

    Record::factory()->create([
        'table_id' => $table->id,
        'data' => ['year' => 1920],
    ]);

    Record::factory()->create([
        'table_id' => $table->id,
        'data' => ['year' => 1950],
    ]);

    Record::factory()->create([
        'table_id' => $table->id,
        'data' => ['year' => 2000],
    ]);

    $filters = json_encode([[
        'field' => 'year',
        'operator' => 'gte',
        'value' => 1950,
    ]]);

    $response = $this->actingAs($user)
        ->getJson('/api/v1/records?table_id=' . $table->id . '&filters=' . urlencode($filters));

    $response->assertStatus(200);
    
    $years = collect($response->json('data'))->pluck('data.year')->toArray();
    
    expect($years)->toContain(1950);
    expect($years)->toContain(2000);
    expect($years)->not->toContain(1920);
});
