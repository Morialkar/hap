<?php

use App\Models\Database;
use App\Models\Field;
use App\Models\RecordPoint;
use App\Models\Table;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('GPS record points stay synchronized on create, update, and delete', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->create();
    WorkspaceMember::factory()->create(['user_id' => $user->id, 'workspace_id' => $workspace->id, 'role' => 'owner']);
    $database = Database::factory()->create(['workspace_id' => $workspace->id]);
    $table = Table::factory()->create(['database_id' => $database->id]);
    $field = Field::factory()->create(['table_id' => $table->id, 'name' => 'Position', 'type' => 'gps']);

    $created = $this->actingAs($user)->postJson('/api/v1/records', [
        'table_id' => $table->id,
        'data' => ['Position' => ['lat' => 45.5017, 'lng' => -73.5673]],
    ])->assertCreated();

    $recordId = $created->json('id');
    $this->assertDatabaseHas('record_points', ['record_id' => $recordId, 'field_id' => $field->id, 'latitude' => 45.5017, 'longitude' => -73.5673]);

    $this->actingAs($user)->putJson("/api/v1/records/{$recordId}", [
        'version' => 1,
        'data' => ['Position' => ['lat' => 46.8139, 'lng' => -71.2080]],
    ])->assertOk();

    $this->assertDatabaseMissing('record_points', ['record_id' => $recordId, 'latitude' => 45.5017]);
    $this->assertDatabaseHas('record_points', ['record_id' => $recordId, 'field_id' => $field->id, 'latitude' => 46.8139, 'longitude' => -71.2080]);

    $this->actingAs($user)->deleteJson("/api/v1/records/{$recordId}")->assertNoContent();
    expect(RecordPoint::where('record_id', $recordId)->exists())->toBeFalse();
});
