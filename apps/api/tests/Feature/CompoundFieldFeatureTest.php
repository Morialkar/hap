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

test('user can create compound field and save record which resolves it', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->create();
    WorkspaceMember::factory()->create([
        'user_id' => $user->id,
        'workspace_id' => $workspace->id,
        'role' => 'owner',
    ]);

    $database = Database::factory()->create(['workspace_id' => $workspace->id]);
    $table = Table::factory()->create(['database_id' => $database->id]);

    // Create First Name and Last Name fields
    $firstNameField = Field::create([
        'table_id' => $table->id,
        'name' => 'Prénom',
        'type' => 'text',
        'position' => 0,
    ]);

    $lastNameField = Field::create([
        'table_id' => $table->id,
        'name' => 'Nom',
        'type' => 'text',
        'position' => 1,
    ]);

    // Create a compound field: Nom Complet => ${Prénom} ${Nom}
    $response = $this->actingAs($user)
        ->postJson('/api/v1/fields', [
            'table_id' => $table->id,
            'name' => 'Nom Complet',
            'type' => 'compound',
            'position' => 2,
            'options' => [
                'template' => '${Prénom} ${Nom}',
                'is_title' => true,
            ],
        ]);

    $response->assertStatus(201)
        ->assertJson([
            'table_id' => $table->id,
            'name' => 'Nom Complet',
            'type' => 'compound',
        ]);

    // Create a record with Prénom and Nom
    $recordResponse = $this->actingAs($user)
        ->postJson('/api/v1/records', [
            'table_id' => $table->id,
            'data' => [
                'Prénom' => 'Camille',
                'Nom' => 'Exemple',
            ],
        ]);

    $recordResponse->assertStatus(201);

    // Check that Nom Complet resolved to "Camille Exemple"
    $recordData = $recordResponse->json('data');
    expect($recordData['Nom Complet'])->toBe('Camille Exemple');

    // Update the record and check recalculation
    $recordId = $recordResponse->json('id');
    $updateResponse = $this->actingAs($user)
        ->putJson("/api/v1/records/{$recordId}", [
            'version' => 1,
            'data' => [
                'Prénom' => 'Sacha',
                'Nom' => 'Exemple',
            ],
        ]);

    $updateResponse->assertStatus(200);
    expect($updateResponse->json('data.Nom Complet'))->toBe('Sacha Exemple');
});

test('pre-existing records have compound fields calculated dynamically on read', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->create();
    WorkspaceMember::factory()->create([
        'user_id' => $user->id,
        'workspace_id' => $workspace->id,
        'role' => 'owner',
    ]);

    $database = Database::factory()->create(['workspace_id' => $workspace->id]);
    $table = Table::factory()->create(['database_id' => $database->id]);

    // Create standard fields
    $firstNameField = Field::create([
        'table_id' => $table->id,
        'name' => 'Prénom',
        'type' => 'text',
        'position' => 0,
    ]);

    $lastNameField = Field::create([
        'table_id' => $table->id,
        'name' => 'Nom',
        'type' => 'text',
        'position' => 1,
    ]);

    // Create a record *before* the compound field exists
    $record = Record::create([
        'table_id' => $table->id,
        'data' => [
            'Prénom' => 'Camille',
            'Nom' => 'Exemple',
        ],
        'version' => 1,
    ]);

    // Now, create the compound field
    Field::create([
        'table_id' => $table->id,
        'name' => 'Nom Complet',
        'type' => 'compound',
        'position' => 2,
        'options' => [
            'template' => '${Prénom} ${Nom}',
        ],
    ]);

    // Fetch the record via GET request
    $response = $this->actingAs($user)
        ->getJson("/api/v1/records/{$record->id}");

    $response->assertStatus(200);

    // Verify it was calculated dynamically on the fly!
    expect($response->json('data.Nom Complet'))->toBe('Camille Exemple');
});
