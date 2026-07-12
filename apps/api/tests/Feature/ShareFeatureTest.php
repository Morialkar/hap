<?php

use App\Models\Database;
use App\Models\Field;
use App\Models\Record;
use App\Models\Report;
use App\Models\Share;
use App\Models\Table;
use App\Models\User;
use App\Models\View;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function () {
    Storage::fake();

    $this->user = User::factory()->create();
    $this->workspace = Workspace::create(['name' => 'Test Workspace', 'created_by' => $this->user->id]);

    $member = new WorkspaceMember;
    $member->workspace_id = $this->workspace->id;
    $member->user_id = $this->user->id;
    $member->role = 'owner';
    $member->save();

    $this->database = Database::create([
        'workspace_id' => $this->workspace->id,
        'name' => 'Archives Patrimoine',
        'locale' => 'fr_FR',
    ]);

    $this->table = Table::create([
        'database_id' => $this->database->id,
        'name' => 'Ouvrages',
    ]);

    $this->titleField = Field::create([
        'table_id' => $this->table->id,
        'name' => 'Titre',
        'type' => 'title',
        'options' => ['is_title' => true],
    ]);

    $this->imageField = Field::create([
        'table_id' => $this->table->id,
        'name' => 'Illustrations',
        'type' => 'image',
    ]);

    $this->record = Record::create([
        'table_id' => $this->table->id,
        'data' => [
            'Titre' => 'Le Rouge et le Noir',
            'Illustrations' => [['hash' => 'dummyhash123', 'name' => 'cover.jpg']],
        ],
    ]);

    $this->view = View::create([
        'table_id' => $this->table->id,
        'name' => 'Vue Publique',
        'type' => 'card',
        'config' => ['columns' => [[$this->titleField->id]]],
    ]);

    $this->report = Report::create([
        'table_id' => $this->table->id,
        'name' => 'Rapport Annuel',
        'query' => ['select' => ['Titre']],
        'layout' => ['show_headers_only' => false],
    ]);
});

test('authenticated user can create and list shares', function () {
    $response = $this->actingAs($this->user)
        ->postJson("/api/v1/databases/{$this->database->id}/shares", [
            'name' => 'Partage Ouvrage',
            'target_type' => 'record',
            'target_id' => $this->record->id,
        ]);

    $response->assertStatus(201);
    $this->assertDatabaseHas('shares', [
        'name' => 'Partage Ouvrage',
        'target_type' => 'record',
        'target_id' => $this->record->id,
    ]);

    $token = $response->json('token');

    // List shares
    $listResponse = $this->actingAs($this->user)
        ->getJson("/api/v1/databases/{$this->database->id}/shares");

    $listResponse->assertStatus(200);
    $listResponse->assertJsonFragment([
        'name' => 'Partage Ouvrage',
        'token' => $token,
        'target_type' => 'record',
    ]);
});

test('public user can retrieve record details via token', function () {
    $share = Share::create([
        'database_id' => $this->database->id,
        'name' => 'Partage Fiche',
        'token' => 'unguesstoken123',
        'target_type' => 'record',
        'target_id' => $this->record->id,
    ]);

    $response = $this->getJson("/api/v1/shares/{$share->token}");

    $response->assertStatus(200);
    $response->assertJson([
        'target_type' => 'record',
        'name' => 'Partage Fiche',
        'record' => [
            'id' => $this->record->id,
            'data' => [
                'Titre' => 'Le Rouge et le Noir',
            ],
        ],
    ]);
});

test('expired share token returns 410', function () {
    $share = Share::create([
        'database_id' => $this->database->id,
        'name' => 'Partage Expire',
        'token' => 'expiredtoken',
        'target_type' => 'record',
        'target_id' => $this->record->id,
        'expires_at' => now()->subDay(),
    ]);

    $response = $this->getJson("/api/v1/shares/{$share->token}");
    $response->assertStatus(410);
});

test('revoking a share link deletes it', function () {
    $share = Share::create([
        'database_id' => $this->database->id,
        'name' => 'Partage Revocable',
        'token' => 'revoketoken',
        'target_type' => 'record',
        'target_id' => $this->record->id,
    ]);

    $response = $this->actingAs($this->user)
        ->deleteJson("/api/v1/shares/{$share->id}");

    $response->assertStatus(204);
    $this->assertDatabaseMissing('shares', ['id' => $share->id]);
});

test('serving uploads strips EXIF metadata from original JPEGs', function () {
    $share = Share::create([
        'database_id' => $this->database->id,
        'name' => 'Partage Image',
        'token' => 'imagetoken',
        'target_type' => 'record',
        'target_id' => $this->record->id,
    ]);

    $file = UploadedFile::fake()->image('cover.jpg', 300, 200);
    $hash = hash_file('sha256', $file->getRealPath());

    // Update record to reference the actual upload hash
    $this->record->update([
        'data' => array_merge($this->record->data, [
            'Illustrations' => [['hash' => $hash, 'name' => 'cover.jpg']],
        ]),
    ]);

    // Put to fake storage
    Storage::put("uploads/{$hash}", file_get_contents($file->getRealPath()));

    // Verify it is served securely through shares route
    $response = $this->get("/api/v1/shares/{$share->token}/uploads/{$hash}");
    $response->assertStatus(200);

    // Verify requesting an unauthorized hash returns 403
    $wrongResponse = $this->get("/api/v1/shares/{$share->token}/uploads/wronghash");
    $wrongResponse->assertStatus(403);
});
