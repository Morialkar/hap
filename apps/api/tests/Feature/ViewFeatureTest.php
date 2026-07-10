<?php

use App\Models\Database;
use App\Models\Table;
use App\Models\User;
use App\Models\View;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('user can create a view for their table', function () {
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
        ->postJson('/api/v1/views', [
            'table_id' => $table->id,
            'name' => 'Default Card',
            'type' => 'card',
            'config' => [
                'columnCount' => 2,
                'columns' => [
                    ['field-1', 'field-2'],
                    ['field-3'],
                ],
            ],
        ]);

    $response->assertStatus(201)
        ->assertJson([
            'table_id' => $table->id,
            'name' => 'Default Card',
            'type' => 'card',
            'config' => [
                'columnCount' => 2,
                'columns' => [
                    ['field-1', 'field-2'],
                    ['field-3'],
                ],
            ],
        ]);

    $this->assertDatabaseHas('views', [
        'table_id' => $table->id,
        'name' => 'Default Card',
    ]);
});

test('user can list views filtered by table', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->create();
    WorkspaceMember::factory()->create([
        'user_id' => $user->id,
        'workspace_id' => $workspace->id,
        'role' => 'owner',
    ]);

    $database = Database::factory()->create(['workspace_id' => $workspace->id]);
    $table = Table::factory()->create(['database_id' => $database->id]);

    $view1 = View::factory()->create(['table_id' => $table->id, 'name' => 'View 1']);
    $view2 = View::factory()->create(['table_id' => $table->id, 'name' => 'View 2']);
    
    // Create another view in different table
    $otherTable = Table::factory()->create(['database_id' => $database->id]);
    $view3 = View::factory()->create(['table_id' => $otherTable->id, 'name' => 'View 3']);

    $response = $this->actingAs($user)
        ->getJson('/api/v1/views?table_id=' . $table->id);

    $response->assertStatus(200)
        ->assertJsonCount(2);
});

test('user can update view config and name', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->create();
    WorkspaceMember::factory()->create([
        'user_id' => $user->id,
        'workspace_id' => $workspace->id,
        'role' => 'owner',
    ]);

    $database = Database::factory()->create(['workspace_id' => $workspace->id]);
    $table = Table::factory()->create(['database_id' => $database->id]);
    $view = View::factory()->create(['table_id' => $table->id, 'name' => 'Old Name']);

    $response = $this->actingAs($user)
        ->putJson('/api/v1/views/' . $view->id, [
            'name' => 'New Name',
            'config' => [
                'columnCount' => 3,
                'columns' => [['f1'], ['f2'], ['f3']],
            ],
        ]);

    $response->assertStatus(200)
        ->assertJson([
            'name' => 'New Name',
            'config' => [
                'columnCount' => 3,
                'columns' => [['f1'], ['f2'], ['f3']],
            ],
        ]);

    $this->assertDatabaseHas('views', [
        'id' => $view->id,
        'name' => 'New Name',
    ]);
});

test('user can delete view', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->create();
    WorkspaceMember::factory()->create([
        'user_id' => $user->id,
        'workspace_id' => $workspace->id,
        'role' => 'owner',
    ]);

    $database = Database::factory()->create(['workspace_id' => $workspace->id]);
    $table = Table::factory()->create(['database_id' => $database->id]);
    $view = View::factory()->create(['table_id' => $table->id]);

    $response = $this->actingAs($user)
        ->deleteJson('/api/v1/views/' . $view->id);

    $response->assertStatus(204);

    $this->assertDatabaseMissing('views', [
        'id' => $view->id,
    ]);
});

test('validation rejects invalid view types', function () {
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
        ->postJson('/api/v1/views', [
            'table_id' => $table->id,
            'name' => 'Invalid Type View',
            'type' => 'invalid_type_here',
        ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['type']);
});

test('setting a view as default resets other default views on the same table', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->create();
    WorkspaceMember::factory()->create([
        'user_id' => $user->id,
        'workspace_id' => $workspace->id,
        'role' => 'owner',
    ]);

    $database = Database::factory()->create(['workspace_id' => $workspace->id]);
    $table = Table::factory()->create(['database_id' => $database->id]);

    $view1 = View::create([
        'table_id' => $table->id,
        'name' => 'View 1',
        'type' => 'card',
        'is_default' => true,
    ]);

    $view2 = View::create([
        'table_id' => $table->id,
        'name' => 'View 2',
        'type' => 'card',
        'is_default' => false,
    ]);

    $response = $this->actingAs($user)
        ->putJson('/api/v1/views/' . $view2->id, [
            'is_default' => true,
        ]);

    $response->assertStatus(200)
        ->assertJson([
            'is_default' => true,
        ]);

    $view1->refresh();
    expect($view1->is_default)->toBeFalse();
});
