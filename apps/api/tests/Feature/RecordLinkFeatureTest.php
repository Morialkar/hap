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

test('record links are synced on record creation with reference field', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->create();
    WorkspaceMember::factory()->create([
        'user_id' => $user->id,
        'workspace_id' => $workspace->id,
        'role' => 'owner',
    ]);

    $database = Database::factory()->create(['workspace_id' => $workspace->id]);
    $table = Table::factory()->create(['database_id' => $database->id]);

    $referenceField = Field::factory()->create([
        'table_id' => $table->id,
        'name' => 'author',
        'type' => 'reference',
        'options' => ['multi' => false, 'target_table' => $table->id],
    ]);

    $targetRecord = Record::factory()->create(['table_id' => $table->id]);

    $response = $this->actingAs($user)
        ->postJson('/api/v1/records', [
            'table_id' => $table->id,
            'data' => [
                'author' => $targetRecord->id,
            ],
        ]);

    $newRecordId = $response->json('id');

    $this->assertDatabaseHas('record_links', [
        'from_record' => $newRecordId,
        'field_id' => $referenceField->id,
        'to_record' => $targetRecord->id,
    ]);
});

test('record links are synced on record update', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->create();
    WorkspaceMember::factory()->create([
        'user_id' => $user->id,
        'workspace_id' => $workspace->id,
        'role' => 'owner',
    ]);

    $database = Database::factory()->create(['workspace_id' => $workspace->id]);
    $table = Table::factory()->create(['database_id' => $database->id]);

    $referenceField = Field::factory()->create([
        'table_id' => $table->id,
        'name' => 'author',
        'type' => 'reference',
        'options' => ['multi' => false, 'target_table' => $table->id],
    ]);

    $targetRecord1 = Record::factory()->create(['table_id' => $table->id]);
    $targetRecord2 = Record::factory()->create(['table_id' => $table->id]);

    $record = Record::factory()->create(['table_id' => $table->id]);

    $this->actingAs($user)
        ->putJson('/api/v1/records/'.$record->id, [
            'data' => [
                'author' => $targetRecord1->id,
            ],
        ]);

    $this->assertDatabaseHas('record_links', [
        'from_record' => $record->id,
        'field_id' => $referenceField->id,
        'to_record' => $targetRecord1->id,
    ]);

    $this->actingAs($user)
        ->putJson('/api/v1/records/'.$record->id, [
            'data' => [
                'author' => $targetRecord2->id,
            ],
        ]);

    $this->assertDatabaseMissing('record_links', [
        'from_record' => $record->id,
        'field_id' => $referenceField->id,
        'to_record' => $targetRecord1->id,
    ]);

    $this->assertDatabaseHas('record_links', [
        'from_record' => $record->id,
        'field_id' => $referenceField->id,
        'to_record' => $targetRecord2->id,
    ]);
});

test('record links support multi-reference fields', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->create();
    WorkspaceMember::factory()->create([
        'user_id' => $user->id,
        'workspace_id' => $workspace->id,
        'role' => 'owner',
    ]);

    $database = Database::factory()->create(['workspace_id' => $workspace->id]);
    $table = Table::factory()->create(['database_id' => $database->id]);

    $referenceField = Field::factory()->create([
        'table_id' => $table->id,
        'name' => 'authors',
        'type' => 'reference',
        'options' => ['multi' => true, 'target_table' => $table->id],
    ]);

    $targetRecord1 = Record::factory()->create(['table_id' => $table->id]);
    $targetRecord2 = Record::factory()->create(['table_id' => $table->id]);

    $response = $this->actingAs($user)
        ->postJson('/api/v1/records', [
            'table_id' => $table->id,
            'data' => [
                'authors' => [$targetRecord1->id, $targetRecord2->id],
            ],
        ]);

    $recordId = $response->json('id');

    $this->assertDatabaseHas('record_links', [
        'from_record' => $recordId,
        'field_id' => $referenceField->id,
        'to_record' => $targetRecord1->id,
    ]);

    $this->assertDatabaseHas('record_links', [
        'from_record' => $recordId,
        'field_id' => $referenceField->id,
        'to_record' => $targetRecord2->id,
    ]);
});

test('deleting a referenced record is blocked with error counts', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->create();
    WorkspaceMember::factory()->create([
        'user_id' => $user->id,
        'workspace_id' => $workspace->id,
        'role' => 'owner',
    ]);

    $database = Database::factory()->create(['workspace_id' => $workspace->id]);
    $table = Table::factory()->create(['database_id' => $database->id]);

    $referenceField = Field::factory()->create([
        'table_id' => $table->id,
        'name' => 'author',
        'type' => 'reference',
        'options' => ['multi' => false, 'target_table' => $table->id],
    ]);

    $targetRecord = Record::factory()->create(['table_id' => $table->id]);

    $this->actingAs($user)
        ->postJson('/api/v1/records', [
            'table_id' => $table->id,
            'data' => [
                'author' => $targetRecord->id,
            ],
        ]);

    $response = $this->actingAs($user)
        ->deleteJson('/api/v1/records/'.$targetRecord->id);

    $response->assertStatus(409)
        ->assertJson([
            'error' => 'Cannot delete record that is referenced by other records',
        ])
        ->assertJsonStructure([
            'error',
            'reference_counts' => [
                'total',
                'by_field',
            ],
        ]);

    $this->assertDatabaseHas('records', ['id' => $targetRecord->id]);
});

test('reverse-lookup endpoint returns records referencing a record', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->create();
    WorkspaceMember::factory()->create([
        'user_id' => $user->id,
        'workspace_id' => $workspace->id,
        'role' => 'owner',
    ]);

    $database = Database::factory()->create(['workspace_id' => $workspace->id]);
    $table = Table::factory()->create(['database_id' => $database->id]);

    $referenceField = Field::factory()->create([
        'table_id' => $table->id,
        'name' => 'author',
        'type' => 'reference',
        'options' => ['multi' => false, 'target_table' => $table->id],
    ]);

    $targetRecord = Record::factory()->create(['table_id' => $table->id]);

    $this->actingAs($user)
        ->postJson('/api/v1/records', [
            'table_id' => $table->id,
            'data' => [
                'author' => $targetRecord->id,
            ],
        ]);

    $response = $this->actingAs($user)
        ->getJson('/api/v1/records/'.$targetRecord->id.'/referencing-records');

    $response->assertStatus(200)
        ->assertJsonStructure([
            'data' => [
                '*' => [
                    'record_id',
                    'table_id',
                    'field_id',
                    'field_name',
                    'record_data',
                ],
            ],
            'pagination' => [
                'current_page',
                'per_page',
                'total',
                'last_page',
            ],
        ]);

    expect($response->json('data'))->toHaveCount(1);
});

test('reassign endpoint moves links from one record to another', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->create();
    WorkspaceMember::factory()->create([
        'user_id' => $user->id,
        'workspace_id' => $workspace->id,
        'role' => 'owner',
    ]);

    $database = Database::factory()->create(['workspace_id' => $workspace->id]);
    $table = Table::factory()->create(['database_id' => $database->id]);

    $referenceField = Field::factory()->create([
        'table_id' => $table->id,
        'name' => 'author',
        'type' => 'reference',
        'options' => ['multi' => false, 'target_table' => $table->id],
    ]);

    $fromRecord = Record::factory()->create(['table_id' => $table->id]);
    $toRecord = Record::factory()->create(['table_id' => $table->id]);

    $response = $this->actingAs($user)
        ->postJson('/api/v1/records', [
            'table_id' => $table->id,
            'data' => [
                'author' => $fromRecord->id,
            ],
        ]);

    $referencingRecordId = $response->json('id');

    $this->assertDatabaseHas('record_links', [
        'from_record' => $referencingRecordId,
        'to_record' => $fromRecord->id,
    ]);

    $response = $this->actingAs($user)
        ->postJson('/api/v1/records/'.$fromRecord->id.'/reassign-links', [
            'to_record_id' => $toRecord->id,
        ]);

    $response->assertStatus(200);

    $this->assertDatabaseMissing('record_links', [
        'from_record' => $referencingRecordId,
        'to_record' => $fromRecord->id,
    ]);

    $this->assertDatabaseHas('record_links', [
        'from_record' => $referencingRecordId,
        'to_record' => $toRecord->id,
    ]);
});

test('reassign endpoint requires records from same table', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->create();
    WorkspaceMember::factory()->create([
        'user_id' => $user->id,
        'workspace_id' => $workspace->id,
        'role' => 'owner',
    ]);

    $database = Database::factory()->create(['workspace_id' => $workspace->id]);
    $table1 = Table::factory()->create(['database_id' => $database->id]);
    $table2 = Table::factory()->create(['database_id' => $database->id]);

    $fromRecord = Record::factory()->create(['table_id' => $table1->id]);
    $toRecord = Record::factory()->create(['table_id' => $table2->id]);

    $response = $this->actingAs($user)
        ->postJson('/api/v1/records/'.$fromRecord->id.'/reassign-links', [
            'to_record_id' => $toRecord->id,
        ]);

    $response->assertStatus(500);
});
