<?php

use App\Models\Database;
use App\Models\Field;
use App\Models\Record;
use App\Models\Table;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('user can create record with valid data', function () {
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

    $response = $this->actingAs($user)
        ->postJson('/api/v1/records', [
            'table_id' => $table->id,
            'data' => [
                'title' => 'Test Record',
            ],
        ]);

    $response->assertStatus(201)
        ->assertJson([
            'table_id' => $table->id,
            'data' => [
                'title' => 'Test Record',
            ],
            'version' => 1,
        ]);

    $this->assertDatabaseHas('records', [
        'table_id' => $table->id,
    ]);
});

test('record validation rejects unknown fields', function () {
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

    $response = $this->actingAs($user)
        ->postJson('/api/v1/records', [
            'table_id' => $table->id,
            'data' => [
                'title' => 'Test Record',
                'unknown_field' => 'value',
            ],
        ]);

    $response->assertStatus(422)
        ->assertJson([
            'error' => 'Validation failed',
        ])
        ->assertJsonStructure([
            'error',
            'errors' => [
                'unknown_field',
            ],
        ]);
});

test('record validation uses field-type registry', function () {
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
        'options' => ['max_length' => 10],
    ]);

    $response = $this->actingAs($user)
        ->postJson('/api/v1/records', [
            'table_id' => $table->id,
            'data' => [
                'title' => 'This is way too long',
            ],
        ]);

    $response->assertStatus(422)
        ->assertJson([
            'error' => 'Validation failed',
        ])
        ->assertJsonStructure([
            'error',
            'errors' => [
                'title',
            ],
        ]);
});

test('user can list records filtered by table', function () {
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

    $record = Record::factory()->create(['table_id' => $table->id]);

    $response = $this->actingAs($user)
        ->getJson('/api/v1/records?table_id=' . $table->id);

    $response->assertStatus(200)
        ->assertJsonCount(1);
});

test('user can update record', function () {
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

    $record = Record::factory()->create([
        'table_id' => $table->id,
        'data' => ['title' => 'Original'],
        'version' => 1,
    ]);

    $response = $this->actingAs($user)
        ->putJson('/api/v1/records/' . $record->id, [
            'data' => [
                'title' => 'Updated',
            ],
        ]);

    $response->assertStatus(200)
        ->assertJson([
            'data' => [
                'title' => 'Updated',
            ],
            'version' => 2,
        ]);
});

test('user can soft-delete record', function () {
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

    $record = Record::factory()->create(['table_id' => $table->id]);

    $response = $this->actingAs($user)
        ->deleteJson('/api/v1/records/' . $record->id);

    $response->assertStatus(204);

    $this->assertSoftDeleted('records', ['id' => $record->id]);
});

test('soft-deleted records are excluded from list', function () {
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

    $record = Record::factory()->create(['table_id' => $table->id]);
    $record->delete();

    $response = $this->actingAs($user)
        ->getJson('/api/v1/records?table_id=' . $table->id);

    $response->assertStatus(200)
        ->assertJsonCount(0);
});
