<?php

use App\Models\Database;
use App\Models\Field;
use App\Models\Record;
use App\Models\RecordActivityLog;
use App\Models\Table;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('activity log is created on record creation', function () {
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

    $this->actingAs($user)
        ->postJson('/api/v1/records', [
            'table_id' => $table->id,
            'data' => ['title' => 'Test Record'],
        ]);

    $this->assertDatabaseHas('record_activity_log', [
        'action' => 'create',
        'user_id' => $user->id,
    ]);
});

test('activity log includes field-level diff on update', function () {
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
            'data' => ['title' => 'Original Title'],
        ]);

    $recordId = $response->json('id');

    $this->actingAs($user)
        ->putJson('/api/v1/records/' . $recordId, [
            'data' => ['title' => 'Updated Title'],
        ]);

    $log = RecordActivityLog::where('action', 'update')->first();
    
    expect($log->changes['diff']['title'])->toBe([
        'type' => 'changed',
        'old' => 'Original Title',
        'new' => 'Updated Title',
    ]);
});

test('activity log is created on record deletion', function () {
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
            'data' => ['title' => 'Test Record'],
        ]);

    $recordId = $response->json('id');

    $this->actingAs($user)
        ->deleteJson('/api/v1/records/' . $recordId);

    $this->assertDatabaseHas('record_activity_log', [
        'action' => 'delete',
        'user_id' => $user->id,
    ]);
});

test('record history endpoint returns activity log', function () {
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
            'data' => ['title' => 'Test Record'],
        ]);

    $recordId = $response->json('id');

    $response = $this->actingAs($user)
        ->getJson('/api/v1/records/' . $recordId . '/history');

    $response->assertStatus(200)
        ->assertJsonStructure([
            'data' => [
                '*' => [
                    'id',
                    'action',
                    'changes',
                    'user',
                    'created_at',
                ],
            ],
            'pagination',
        ]);

    expect($response->json('data'))->toHaveCount(1);
});

test('restore version endpoint restores record to previous state', function () {
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
            'data' => ['title' => 'Original Title'],
        ]);

    $recordId = $response->json('id');

    $this->actingAs($user)
        ->putJson('/api/v1/records/' . $recordId, [
            'data' => ['title' => 'Updated Title'],
        ]);

    $log = RecordActivityLog::where('action', 'create')->first();

    $response = $this->actingAs($user)
        ->postJson('/api/v1/records/' . $recordId . '/restore-version', [
            'log_id' => $log->id,
        ]);

    $response->assertStatus(200);
    
    expect($response->json('data.title'))->toBe('Original Title');
});

test('trash endpoint returns soft-deleted records', function () {
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
            'data' => ['title' => 'Test Record'],
        ]);

    $recordId = $response->json('id');

    $this->actingAs($user)
        ->deleteJson('/api/v1/records/' . $recordId);

    $response = $this->actingAs($user)
        ->getJson('/api/v1/records/trash?table_id=' . $table->id);

    $response->assertStatus(200);
    
    expect($response->json('data'))->toHaveCount(1);
});

test('restore endpoint restores soft-deleted record', function () {
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
            'data' => ['title' => 'Test Record'],
        ]);

    $recordId = $response->json('id');

    $this->actingAs($user)
        ->deleteJson('/api/v1/records/' . $recordId);

    $response = $this->actingAs($user)
        ->postJson('/api/v1/records/' . $recordId . '/restore');

    $response->assertStatus(200);
    
    $this->assertDatabaseHas('records', [
        'id' => $recordId,
        'deleted_at' => null,
    ]);
});

test('purge endpoint permanently deletes record', function () {
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
            'data' => ['title' => 'Test Record'],
        ]);

    $recordId = $response->json('id');

    $this->actingAs($user)
        ->deleteJson('/api/v1/records/' . $recordId);

    $response = $this->actingAs($user)
        ->deleteJson('/api/v1/records/' . $recordId . '/purge');

    $response->assertStatus(204);
    
    $this->assertDatabaseMissing('records', ['id' => $recordId]);
});

test('optimistic concurrency returns 409 on stale update', function () {
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
            'data' => ['title' => 'Test Record'],
        ]);

    $recordId = $response->json('id');
    $currentVersion = $response->json('version');

    // Simulate stale version
    $staleVersion = $currentVersion - 1;

    $response = $this->actingAs($user)
        ->putJson('/api/v1/records/' . $recordId, [
            'data' => ['title' => 'Updated Title'],
            'version' => $staleVersion,
        ]);

    $response->assertStatus(409)
        ->assertJson([
            'error' => 'Record has been modified by another user',
        ]);
});
