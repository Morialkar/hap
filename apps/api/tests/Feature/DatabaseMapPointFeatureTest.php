<?php

use App\Models\Database;
use App\Models\Field;
use App\Models\Table;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('database map points include GPS points from every table in the database', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->create();
    WorkspaceMember::factory()->create(['user_id' => $user->id, 'workspace_id' => $workspace->id, 'role' => 'owner']);
    $database = Database::factory()->create(['workspace_id' => $workspace->id]);
    $table = Table::factory()->create(['database_id' => $database->id, 'name' => 'Lieux']);
    Field::factory()->create(['table_id' => $table->id, 'name' => 'Position', 'type' => 'gps']);

    $this->actingAs($user)->postJson('/api/v1/records', [
        'table_id' => $table->id,
        'data' => ['Position' => ['lat' => 45.5017, 'lng' => -73.5673]],
    ])->assertCreated();

    $response = $this->actingAs($user)->getJson("/api/v1/databases/{$database->id}/map-points");

    $response->assertOk()->assertJsonPath('data.0.table_name', 'Lieux')
        ->assertJsonPath('data.0.field_name', 'Position')
        ->assertJsonPath('data.0.latitude', 45.5017)
        ->assertJsonPath('data.0.longitude', -73.5673);
});
