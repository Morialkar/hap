<?php

use App\Models\Database;
use App\Models\Table;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('user can create gps field', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->create();
    WorkspaceMember::factory()->create([
        'user_id' => $user->id,
        'workspace_id' => $workspace->id,
        'role' => 'owner',
    ]);

    $database = Database::factory()->create(['workspace_id' => $workspace->id]);
    $table = Table::factory()->create(['database_id' => $database->id]);

    $response = $this->actingAs($user)
        ->postJson('/api/v1/fields', [
            'table_id' => $table->id,
            'name' => 'Lieu',
            'type' => 'gps',
            'position' => 0,
        ]);

    $response->assertStatus(201)
        ->assertJson([
            'table_id' => $table->id,
            'name' => 'Lieu',
            'type' => 'gps',
        ]);
});
