<?php

use App\Models\Database;
use App\Models\Table;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('user can create a table with is_front_facing', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->create();
    WorkspaceMember::factory()->create([
        'user_id' => $user->id,
        'workspace_id' => $workspace->id,
        'role' => 'owner',
    ]);

    $database = Database::factory()->create(['workspace_id' => $workspace->id]);

    $response = $this->actingAs($user)
        ->postJson('/api/v1/tables', [
            'database_id' => $database->id,
            'name' => 'Test Table',
            'is_front_facing' => true,
        ]);

    $response->assertStatus(201)
        ->assertJson([
            'name' => 'Test Table',
            'database_id' => $database->id,
            'is_front_facing' => true,
        ]);

    $this->assertDatabaseHas('tables', [
        'database_id' => $database->id,
        'name' => 'Test Table',
        'is_front_facing' => true,
    ]);
});

test('user can update table is_front_facing', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->create();
    WorkspaceMember::factory()->create([
        'user_id' => $user->id,
        'workspace_id' => $workspace->id,
        'role' => 'owner',
    ]);

    $database = Database::factory()->create(['workspace_id' => $workspace->id]);
    $table = Table::factory()->create(['database_id' => $database->id, 'is_front_facing' => false]);

    $response = $this->actingAs($user)
        ->putJson('/api/v1/tables/'.$table->id, [
            'is_front_facing' => true,
        ]);

    $response->assertStatus(200)
        ->assertJson([
            'id' => $table->id,
            'is_front_facing' => true,
        ]);

    $this->assertDatabaseHas('tables', [
        'id' => $table->id,
        'is_front_facing' => true,
    ]);
});

test('table defaults to not front facing', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->create();
    WorkspaceMember::factory()->create([
        'user_id' => $user->id,
        'workspace_id' => $workspace->id,
        'role' => 'owner',
    ]);

    $database = Database::factory()->create(['workspace_id' => $workspace->id]);

    $response = $this->actingAs($user)
        ->postJson('/api/v1/tables', [
            'database_id' => $database->id,
            'name' => 'Default Table',
        ]);

    $response->assertStatus(201)
        ->assertJson([
            'name' => 'Default Table',
            'is_front_facing' => false,
        ]);
});

test('validation rejects non boolean is_front_facing', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->create();
    WorkspaceMember::factory()->create([
        'user_id' => $user->id,
        'workspace_id' => $workspace->id,
        'role' => 'owner',
    ]);

    $database = Database::factory()->create(['workspace_id' => $workspace->id]);

    $response = $this->actingAs($user)
        ->postJson('/api/v1/tables', [
            'database_id' => $database->id,
            'name' => 'Invalid Table',
            'is_front_facing' => 'invalid-boolean-value',
        ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['is_front_facing']);
});
