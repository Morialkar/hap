<?php

use App\Models\Database;
use App\Models\Field;
use App\Models\SchemaChange;
use App\Models\Table;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('field deletion without confirmation is blocked', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->create();
    WorkspaceMember::factory()->create([
        'user_id' => $user->id,
        'workspace_id' => $workspace->id,
        'role' => 'owner',
    ]);

    $database = Database::factory()->create(['workspace_id' => $workspace->id]);
    $table = Table::factory()->create(['database_id' => $database->id]);
    $field = Field::factory()->create(['table_id' => $table->id, 'name' => 'test_field']);

    $response = $this->actingAs($user)
        ->deleteJson('/api/v1/fields/'.$field->id);

    $response->assertStatus(409)
        ->assertJson([
            'error' => 'Destructive change requires confirmation',
        ])
        ->assertJsonStructure([
            'error',
            'impact' => [
                'affected_records',
                'orphaned_values',
                'coercion_required',
            ],
            'confirmation_token',
        ]);

    $this->assertDatabaseHas('fields', ['id' => $field->id]);
});

test('impact preview returns correct counts', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->create();
    WorkspaceMember::factory()->create([
        'user_id' => $user->id,
        'workspace_id' => $workspace->id,
        'role' => 'owner',
    ]);

    $database = Database::factory()->create(['workspace_id' => $workspace->id]);
    $table = Table::factory()->create(['database_id' => $database->id]);
    $field = Field::factory()->create(['table_id' => $table->id, 'name' => 'test_field']);

    $response = $this->actingAs($user)
        ->getJson('/api/v1/fields/'.$field->id.'/preview-impact');

    $response->assertStatus(200)
        ->assertJson([
            'field_id' => $field->id,
            'field_name' => 'test_field',
            'impact' => [
                'affected_records' => 0,
                'orphaned_values' => 0,
                'coercion_required' => false,
            ],
        ]);
});

test('confirmation token generation', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->create();
    WorkspaceMember::factory()->create([
        'user_id' => $user->id,
        'workspace_id' => $workspace->id,
        'role' => 'owner',
    ]);

    $database = Database::factory()->create(['workspace_id' => $workspace->id]);
    $table = Table::factory()->create(['database_id' => $database->id]);
    $field = Field::factory()->create(['table_id' => $table->id]);

    $response = $this->actingAs($user)
        ->getJson('/api/v1/fields/'.$field->id.'/confirmation-token');

    $response->assertStatus(200)
        ->assertJsonStructure([
            'token',
        ]);

    $token = $response->json('token');
    expect($token)->toBeString();
    expect(strlen($token))->toBe(64); // SHA256 hash length
});

test('field deletion with valid confirmation token succeeds', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->create();
    WorkspaceMember::factory()->create([
        'user_id' => $user->id,
        'workspace_id' => $workspace->id,
        'role' => 'owner',
    ]);

    $database = Database::factory()->create(['workspace_id' => $workspace->id]);
    $table = Table::factory()->create(['database_id' => $database->id]);
    $field = Field::factory()->create(['table_id' => $table->id, 'name' => 'test_field']);

    // Get confirmation token
    $tokenResponse = $this->actingAs($user)
        ->getJson('/api/v1/fields/'.$field->id.'/confirmation-token');
    $token = $tokenResponse->json('token');

    // Delete with token
    $response = $this->actingAs($user)
        ->deleteJson('/api/v1/fields/'.$field->id, [
            'confirmation_token' => $token,
        ]);

    $response->assertStatus(204);

    $this->assertDatabaseMissing('fields', ['id' => $field->id]);
});

test('field deletion with invalid confirmation token is blocked', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->create();
    WorkspaceMember::factory()->create([
        'user_id' => $user->id,
        'workspace_id' => $workspace->id,
        'role' => 'owner',
    ]);

    $database = Database::factory()->create(['workspace_id' => $workspace->id]);
    $table = Table::factory()->create(['database_id' => $database->id]);
    $field = Field::factory()->create(['table_id' => $table->id]);

    $response = $this->actingAs($user)
        ->deleteJson('/api/v1/fields/'.$field->id, [
            'confirmation_token' => 'invalid_token',
        ]);

    $response->assertStatus(409);

    $this->assertDatabaseHas('fields', ['id' => $field->id]);
});

test('schema change is logged after destructive change', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->create();
    WorkspaceMember::factory()->create([
        'user_id' => $user->id,
        'workspace_id' => $workspace->id,
        'role' => 'owner',
    ]);

    $database = Database::factory()->create(['workspace_id' => $workspace->id]);
    $table = Table::factory()->create(['database_id' => $database->id]);
    $field = Field::factory()->create(['table_id' => $table->id, 'name' => 'test_field', 'type' => 'text']);

    // Get confirmation token
    $tokenResponse = $this->actingAs($user)
        ->getJson('/api/v1/fields/'.$field->id.'/confirmation-token');
    $token = $tokenResponse->json('token');

    // Delete with token
    $this->actingAs($user)
        ->deleteJson('/api/v1/fields/'.$field->id, [
            'confirmation_token' => $token,
        ]);

    $this->assertDatabaseHas('schema_changes', [
        'table_id' => $table->id,
        'change_type' => 'delete_field',
        'user_id' => $user->id,
    ]);

    $schemaChange = SchemaChange::where('table_id', $table->id)->first();
    expect($schemaChange->details['field_id'])->toBe($field->id);
    expect($schemaChange->details['field_name'])->toBe('test_field');
    expect($schemaChange->details['field_type'])->toBe('text');
});
