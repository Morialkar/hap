<?php

use App\Models\Database;
use App\Models\Field;
use App\Models\Record;
use App\Models\Table;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;

uses(RefreshDatabase::class);

function createCsvImportFixture(): array
{
    $user = User::factory()->create();
    $workspace = Workspace::factory()->create();

    WorkspaceMember::factory()->create([
        'user_id' => $user->id,
        'workspace_id' => $workspace->id,
        'role' => 'owner',
    ]);

    $database = Database::factory()->create(['workspace_id' => $workspace->id]);
    $authors = Table::factory()->create(['database_id' => $database->id, 'name' => 'Authors']);
    $works = Table::factory()->create(['database_id' => $database->id, 'name' => 'Works']);

    Field::factory()->create([
        'table_id' => $authors->id,
        'name' => 'Nom',
        'type' => 'text',
        'position' => 0,
    ]);

    Field::factory()->create([
        'table_id' => $works->id,
        'name' => 'Titre',
        'type' => 'text',
        'position' => 0,
        'options' => ['max_length' => 80],
    ]);
    Field::factory()->create([
        'table_id' => $works->id,
        'name' => 'Année',
        'type' => 'number',
        'position' => 1,
        'options' => ['decimal' => false],
    ]);
    Field::factory()->create([
        'table_id' => $works->id,
        'name' => 'Publié',
        'type' => 'boolean',
        'position' => 2,
    ]);
    Field::factory()->create([
        'table_id' => $works->id,
        'name' => 'Auteur',
        'type' => 'reference',
        'position' => 3,
        'options' => ['target_table' => $authors->id, 'multi' => false],
    ]);

    $existingAuthor = Record::factory()->create([
        'table_id' => $authors->id,
        'data' => ['Nom' => 'Colette'],
    ]);

    return [$user, $workspace, $database, $works, $authors, $existingAuthor];
}

function csvUpload(string $name, string $contents): UploadedFile
{
    return UploadedFile::fake()->createWithContent($name, $contents);
}

function csvMapping(Table $authors): array
{
    return [
        'Titre' => ['type' => 'field', 'field' => 'Titre'],
        'Année' => ['type' => 'field', 'field' => 'Année'],
        'Publié' => ['type' => 'field', 'field' => 'Publié'],
        'Auteur' => [
            'type' => 'reference',
            'field' => 'Auteur',
            'target_table_id' => $authors->id,
            'display_field' => 'Nom',
            'match_or_create' => true,
        ],
        'Résumé' => [
            'type' => 'create_field',
            'field' => 'Résumé',
            'field_type' => 'text',
            'options' => ['max_length' => 255],
        ],
    ];
}

test('csv dry-run parses utf8 accents and reports a rejected row without creating records or fields', function () {
    [$user, , , $works, $authors] = createCsvImportFixture();

    $file = csvUpload('works.csv', "Titre,Année,Publié,Auteur,Résumé\nChéri,1920,oui,Colette,Été à Paris\nBad Row,not-a-number,non,Colette,Erreur\n");

    $response = $this->actingAs($user)->post('/api/v1/tables/'.$works->id.'/csv-import/dry-run', [
        'file' => $file,
        'mapping' => json_encode(csvMapping($authors)),
    ]);

    $response->assertStatus(200)
        ->assertJsonPath('detected_encoding', 'UTF-8')
        ->assertJsonPath('delimiter', ',')
        ->assertJsonPath('row_count', 2)
        ->assertJsonPath('accepted_count', 1)
        ->assertJsonPath('rejected_count', 1)
        ->assertJsonPath('accepted_rows.0.data.Titre', 'Chéri')
        ->assertJsonPath('accepted_rows.0.data.Année', 1920)
        ->assertJsonPath('accepted_rows.0.data.Publié', true)
        ->assertJsonPath('rejected_rows.0.row', 3);

    $this->assertDatabaseCount('records', 1);
    $this->assertDatabaseMissing('fields', [
        'table_id' => $works->id,
        'name' => 'Résumé',
    ]);
});

test('csv import parses latin1 semicolon files and imports accepted rows with reference match or create', function () {
    [$user, , , $works, $authors, $existingAuthor] = createCsvImportFixture();

    $utf8 = "Titre;Année;Publié;Auteur;Résumé\nChéri;1920;oui;Colette;Été à Paris\nLa Naissance du jour;1928;non;Nouvel Auteur;Résumé inédit\nBad Row;not-a-number;oui;Colette;Erreur\n";
    $latin1 = mb_convert_encoding($utf8, 'ISO-8859-1', 'UTF-8');
    $file = csvUpload('works-latin1.csv', $latin1);

    $response = $this->actingAs($user)->post('/api/v1/tables/'.$works->id.'/csv-import', [
        'file' => $file,
        'mapping' => json_encode(csvMapping($authors)),
    ]);

    $response->assertStatus(201)
        ->assertJsonPath('detected_encoding', 'ISO-8859-1')
        ->assertJsonPath('delimiter', ';')
        ->assertJsonPath('row_count', 3)
        ->assertJsonPath('accepted_count', 2)
        ->assertJsonPath('rejected_count', 1);

    $this->assertDatabaseHas('fields', [
        'table_id' => $works->id,
        'name' => 'Résumé',
        'type' => 'text',
    ]);

    $this->assertDatabaseHas('records', [
        'table_id' => $authors->id,
    ]);
    $this->assertDatabaseCount('record_links', 2);
    $this->assertDatabaseHas('record_links', [
        'to_record' => $existingAuthor->id,
    ]);
    $this->assertDatabaseCount('record_activity_log', 3);

    $imported = Record::where('table_id', $works->id)
        ->where('data->Titre', 'Chéri')
        ->first();

    expect($imported)->not->toBeNull();
    expect($imported->data['Résumé'])->toBe('Été à Paris');
    expect($imported->data['Année'])->toBe(1920);
});

test('csv import rejects invalid reference mapping before creating records', function () {
    [$user, , , $works, $authors] = createCsvImportFixture();

    $file = csvUpload('works.csv', "Titre,Auteur\nChéri,Colette\n");
    $mapping = csvMapping($authors);
    $mapping['Auteur']['display_field'] = 'Missing field';

    $response = $this->actingAs($user)->post('/api/v1/tables/'.$works->id.'/csv-import', [
        'file' => $file,
        'mapping' => json_encode($mapping),
    ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['mapping.Auteur.display_field']);

    $this->assertDatabaseCount('records', 1);
});

test('non-owner workspace members cannot dry-run or import csv data', function () {
    [$owner, $workspace, , $works, $authors] = createCsvImportFixture();
    $viewer = User::factory()->create();

    WorkspaceMember::factory()->create([
        'user_id' => $viewer->id,
        'workspace_id' => $workspace->id,
        'role' => 'viewer',
    ]);

    $file = csvUpload('works.csv', "Titre,Année\nChéri,1920\n");
    $payload = [
        'file' => $file,
        'mapping' => json_encode(csvMapping($authors)),
    ];

    $this->actingAs($viewer)
        ->post('/api/v1/tables/'.$works->id.'/csv-import/dry-run', $payload)
        ->assertStatus(403);

    $this->actingAs($viewer)
        ->post('/api/v1/tables/'.$works->id.'/csv-import', $payload)
        ->assertStatus(403);

    $this->actingAs($owner)
        ->post('/api/v1/tables/'.$works->id.'/csv-import/dry-run', $payload)
        ->assertStatus(200);
});
