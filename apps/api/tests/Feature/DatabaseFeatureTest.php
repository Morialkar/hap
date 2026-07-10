<?php

use App\Models\Database;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('user can create database in their workspace', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->create();
    WorkspaceMember::factory()->create([
        'user_id' => $user->id,
        'workspace_id' => $workspace->id,
        'role' => 'owner',
    ]);

    $response = $this->actingAs($user)
        ->postJson('/api/v1/databases', [
            'name' => 'Test Database',
            'workspace_id' => $workspace->id,
        ]);

    $response->assertStatus(201)
        ->assertJson([
            'name' => 'Test Database',
            'workspace_id' => $workspace->id,
        ]);

    $this->assertDatabaseHas('databases', [
        'name' => 'Test Database',
        'workspace_id' => $workspace->id,
    ]);
});

test('user can list databases in their workspace', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->create();
    WorkspaceMember::factory()->create([
        'user_id' => $user->id,
        'workspace_id' => $workspace->id,
        'role' => 'owner',
    ]);

    Database::factory()->create(['workspace_id' => $workspace->id, 'name' => 'Database 1']);
    Database::factory()->create(['workspace_id' => $workspace->id, 'name' => 'Database 2']);

    $response = $this->actingAs($user)
        ->getJson('/api/v1/databases?workspace_id='.$workspace->id);

    $response->assertStatus(200)
        ->assertJsonCount(2);
});

test('user cannot see databases from another workspace', function () {
    $userA = User::factory()->create();
    $userB = User::factory()->create();

    $workspaceA = Workspace::factory()->create();
    $workspaceB = Workspace::factory()->create();

    WorkspaceMember::factory()->create([
        'user_id' => $userA->id,
        'workspace_id' => $workspaceA->id,
        'role' => 'owner',
    ]);

    WorkspaceMember::factory()->create([
        'user_id' => $userB->id,
        'workspace_id' => $workspaceB->id,
        'role' => 'owner',
    ]);

    Database::factory()->create(['workspace_id' => $workspaceA->id, 'name' => 'A Database']);
    Database::factory()->create(['workspace_id' => $workspaceB->id, 'name' => 'B Database']);

    $response = $this->actingAs($userA)
        ->getJson('/api/v1/databases?workspace_id='.$workspaceA->id);

    $response->assertStatus(200)
        ->assertJsonCount(1)
        ->assertJsonPath('0.name', 'A Database');
});

test('user can update their database', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->create();
    WorkspaceMember::factory()->create([
        'user_id' => $user->id,
        'workspace_id' => $workspace->id,
        'role' => 'owner',
    ]);

    $database = Database::factory()->create(['workspace_id' => $workspace->id, 'name' => 'Old Name']);

    $response = $this->actingAs($user)
        ->putJson('/api/v1/databases/'.$database->id, [
            'name' => 'New Name',
        ]);

    $response->assertStatus(200)
        ->assertJson([
            'name' => 'New Name',
        ]);

    $this->assertDatabaseHas('databases', [
        'id' => $database->id,
        'name' => 'New Name',
    ]);
});

test('user can delete their database', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->create();
    WorkspaceMember::factory()->create([
        'user_id' => $user->id,
        'workspace_id' => $workspace->id,
        'role' => 'owner',
    ]);

    $database = Database::factory()->create(['workspace_id' => $workspace->id]);

    $response = $this->actingAs($user)
        ->deleteJson('/api/v1/databases/'.$database->id);

    $response->assertStatus(204);

    $this->assertDatabaseMissing('databases', [
        'id' => $database->id,
    ]);
});

test('validation requires name when creating database', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->create();
    WorkspaceMember::factory()->create([
        'user_id' => $user->id,
        'workspace_id' => $workspace->id,
        'role' => 'owner',
    ]);

    $response = $this->actingAs($user)
        ->postJson('/api/v1/databases', [
            'workspace_id' => $workspace->id,
        ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['name']);
});
