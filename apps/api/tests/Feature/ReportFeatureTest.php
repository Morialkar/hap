<?php

use App\Models\Database;
use App\Models\Field;
use App\Models\Record;
use App\Models\Report;
use App\Models\Table;
use App\Models\User;
use App\Models\View;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function createAuthenticatedUser()
{
    $user = User::factory()->create();
    $workspace = Workspace::factory()->create();
    WorkspaceMember::factory()->create([
        'user_id' => $user->id,
        'workspace_id' => $workspace->id,
        'role' => 'owner',
    ]);

    $database = Database::factory()->create(['workspace_id' => $workspace->id]);
    $table = Table::factory()->create(['database_id' => $database->id]);

    return [
        'user' => $user,
        'workspace' => $workspace,
        'database' => $database,
        'table' => $table,
    ];
}

test('report CRUD operations', function () {
    $setup = createAuthenticatedUser();
    $user = $setup['user'];
    $table = $setup['table'];

    // Create Report
    $payload = [
        'table_id' => $table->id,
        'name' => 'Monthly sales',
        'query' => [
            'select' => ['title', 'price'],
            'where' => [
                'logic' => 'and',
                'conditions' => [
                    ['field' => 'price', 'operator' => 'gt', 'value' => 10],
                ],
            ],
        ],
        'layout' => [
            'fields' => [
                ['name' => 'title', 'visible' => true, 'order' => 1],
                ['name' => 'price', 'visible' => true, 'order' => 2],
            ],
            'group_order' => [],
        ],
    ];

    $response = $this->actingAs($user)
        ->postJson('/api/v1/reports', $payload);

    $response->assertStatus(201)
        ->assertJsonPath('name', 'Monthly sales')
        ->assertJsonPath('query.select', ['title', 'price']);

    $reportId = $response->json('id');

    // List Reports
    $listResponse = $this->actingAs($user)
        ->getJson('/api/v1/reports?database_id='.$setup['database']->id);

    $listResponse->assertStatus(200)
        ->assertJsonCount(1);

    // Show Report
    $showResponse = $this->actingAs($user)
        ->getJson('/api/v1/reports/'.$reportId);

    $showResponse->assertStatus(200)
        ->assertJsonPath('name', 'Monthly sales');

    // Update Report
    $updatePayload = [
        'name' => 'Updated monthly sales',
        'layout' => [
            'fields' => [
                ['name' => 'title', 'visible' => true, 'order' => 2],
                ['name' => 'price', 'visible' => false, 'order' => 1],
            ],
        ],
    ];

    $updateResponse = $this->actingAs($user)
        ->putJson('/api/v1/reports/'.$reportId, $updatePayload);

    $updateResponse->assertStatus(200)
        ->assertJsonPath('name', 'Updated monthly sales')
        ->assertJsonPath('layout.fields.1.visible', false);

    // Destroy Report
    $deleteResponse = $this->actingAs($user)
        ->deleteJson('/api/v1/reports/'.$reportId);

    $deleteResponse->assertStatus(204);

    $this->assertDatabaseMissing('reports', ['id' => $reportId]);
});

test('paginated preview of report query with layout constraints', function () {
    $setup = createAuthenticatedUser();
    $user = $setup['user'];
    $table = $setup['table'];

    // Setup fields
    $titleField = Field::factory()->create([
        'table_id' => $table->id,
        'name' => 'title',
        'type' => 'text',
    ]);
    $priceField = Field::factory()->create([
        'table_id' => $table->id,
        'name' => 'price',
        'type' => 'number',
    ]);
    $genreField = Field::factory()->create([
        'table_id' => $table->id,
        'name' => 'genre',
        'type' => 'text',
    ]);

    // Create 5 records
    for ($i = 1; $i <= 5; $i++) {
        Record::factory()->create([
            'table_id' => $table->id,
            'data' => [
                'title' => 'Book '.$i,
                'price' => $i * 10,
                'genre' => $i % 2 === 0 ? 'Sci-Fi' : 'Fantasy',
            ],
        ]);
    }

    $previewPayload = [
        'table_id' => $table->id,
        'query' => [
            'select' => ['title', 'price', 'genre'],
            'group_by' => 'genre',
            'sort' => [
                ['field' => 'price', 'direction' => 'desc'],
            ],
        ],
        'layout' => [
            'fields' => [
                ['name' => 'title', 'visible' => true, 'order' => 1],
                ['name' => 'price', 'visible' => true, 'order' => 2],
                ['name' => 'genre', 'visible' => false, 'order' => 3], // genre hidden in layout
            ],
            'group_order' => ['Sci-Fi', 'Fantasy'], // Custom group ordering
        ],
        'per_page' => 3,
        'page' => 1,
    ];

    $response = $this->actingAs($user)
        ->postJson('/api/v1/reports/preview', $previewPayload);

    $response->assertStatus(200)
        ->assertJsonStructure([
            'columns',
            'groups' => [
                '*' => [
                    'key',
                    'records',
                ],
            ],
            'pagination' => [
                'current_page',
                'per_page',
                'total',
                'last_page',
            ],
        ]);

    // Paginated check (3 items out of 5 total)
    expect($response->json('pagination.total'))->toBe(5);
    expect($response->json('pagination.current_page'))->toBe(1);
    expect($response->json('pagination.per_page'))->toBe(3);

    // Layout check: genre should be excluded from columns and records
    expect($response->json('columns'))->toBe(['title', 'price']);
    $groups = $response->json('groups');
    foreach ($groups as $group) {
        foreach ($group['records'] as $rec) {
            expect($rec)->not->toHaveKey('genre');
            expect($rec)->toHaveKey('title');
            expect($rec)->toHaveKey('price');
        }
    }

    // Group order check: Sci-Fi first, Fantasy second
    expect($groups[0]['key'])->toBe('Sci-Fi');
    expect($groups[1]['key'])->toBe('Fantasy');
});

test('saved report execution with override pagination', function () {
    $setup = createAuthenticatedUser();
    $user = $setup['user'];
    $table = $setup['table'];

    // Setup fields
    $titleField = Field::factory()->create([
        'table_id' => $table->id,
        'name' => 'title',
        'type' => 'text',
    ]);
    $priceField = Field::factory()->create([
        'table_id' => $table->id,
        'name' => 'price',
        'type' => 'number',
    ]);

    // Create 3 records
    for ($i = 1; $i <= 3; $i++) {
        Record::factory()->create([
            'table_id' => $table->id,
            'data' => [
                'title' => 'Product '.$i,
                'price' => $i * 100,
            ],
        ]);
    }

    // Create Report
    $report = Report::create([
        'table_id' => $table->id,
        'name' => 'Expensive products',
        'query' => [
            'select' => ['title', 'price'],
            'where' => [
                'logic' => 'and',
                'conditions' => [
                    ['field' => 'price', 'operator' => 'gt', 'value' => 150],
                ],
            ],
        ],
        'layout' => [
            'fields' => [
                ['name' => 'title', 'visible' => true, 'order' => 1],
                ['name' => 'price', 'visible' => true, 'order' => 2],
            ],
        ],
    ]);

    // Execute with no pagination
    $response = $this->actingAs($user)
        ->postJson("/api/v1/reports/{$report->id}/execute");

    $response->assertStatus(200)
        ->assertJsonMissing(['pagination']);

    $records = collect($response->json('groups'))->flatMap(fn ($g) => $g['records']);
    expect($records)->toHaveCount(2); // Product 2 (200), Product 3 (300)

    // Execute with override pagination (1 per page, page 2)
    $responseOverride = $this->actingAs($user)
        ->postJson("/api/v1/reports/{$report->id}/execute", [
            'per_page' => 1,
            'page' => 2,
        ]);

    $responseOverride->assertStatus(200)
        ->assertJsonStructure(['pagination']);

    expect($responseOverride->json('pagination.total'))->toBe(2);
    expect($responseOverride->json('pagination.current_page'))->toBe(2);
    expect($responseOverride->json('pagination.last_page'))->toBe(2);

    $recordsOverride = collect($responseOverride->json('groups'))->flatMap(fn ($g) => $g['records']);
    expect($recordsOverride)->toHaveCount(1);
});

test('export saved report and preview as PDF and CSV formats', function () {
    $setup = createAuthenticatedUser();
    $user = $setup['user'];
    $table = $setup['table'];

    // Setup fields
    $titleField = Field::factory()->create([
        'table_id' => $table->id,
        'name' => 'title',
        'type' => 'text',
    ]);
    $priceField = Field::factory()->create([
        'table_id' => $table->id,
        'name' => 'price',
        'type' => 'number',
    ]);

    // Create a record
    Record::factory()->create([
        'table_id' => $table->id,
        'data' => [
            'title' => 'Sample item',
            'price' => 99,
        ],
    ]);

    // Create saved Report
    $report = Report::create([
        'table_id' => $table->id,
        'name' => 'Sample report',
        'query' => [
            'select' => ['title', 'price'],
        ],
        'layout' => [
            'fields' => [
                ['name' => 'title', 'visible' => true, 'order' => 1],
                ['name' => 'price', 'visible' => true, 'order' => 2],
            ],
        ],
    ]);

    // 1. Test saved PDF export
    $pdfResponse = $this->actingAs($user)
        ->get("/api/v1/reports/{$report->id}/export/pdf");
    $pdfResponse->assertStatus(200);
    expect($pdfResponse->headers->get('Content-Type'))->toBe('application/pdf');
    expect(str_contains($pdfResponse->getContent(), '%PDF'))->toBeTrue();

    // 2. Test saved CSV export
    $csvResponse = $this->actingAs($user)
        ->get("/api/v1/reports/{$report->id}/export/csv");
    $csvResponse->assertStatus(200);
    expect($csvResponse->headers->get('Content-Type'))->toContain('text/csv');
    expect(str_contains($csvResponse->streamedContent(), 'Sample item'))->toBeTrue();

    // 3. Test on-the-fly preview PDF export
    $previewPdfResponse = $this->actingAs($user)
        ->postJson('/api/v1/reports/preview/pdf', [
            'table_id' => $table->id,
            'name' => 'On the fly PDF',
            'query' => ['select' => ['title']],
        ]);
    $previewPdfResponse->assertStatus(200);
    expect($previewPdfResponse->headers->get('Content-Type'))->toBe('application/pdf');
    expect(str_contains($previewPdfResponse->getContent(), '%PDF'))->toBeTrue();

    // 4. Test on-the-fly preview CSV export
    $previewCsvResponse = $this->actingAs($user)
        ->postJson('/api/v1/reports/preview/csv', [
            'table_id' => $table->id,
            'query' => ['select' => ['title']],
        ]);
    $previewCsvResponse->assertStatus(200);
    expect($previewCsvResponse->headers->get('Content-Type'))->toContain('text/csv');
    expect(str_contains($previewCsvResponse->streamedContent(), 'title'))->toBeTrue();
});

test('layout view_id, show_headers_only and per_page survive save and reload', function () {
    $setup = createAuthenticatedUser();
    $user = $setup['user'];
    $table = $setup['table'];
    $view = View::factory()->create(['table_id' => $table->id]);

    $payload = [
        'table_id' => $table->id,
        'name' => 'Rapport avec vue',
        'query' => ['select' => ['Nom'], 'group_by' => 'Ville'],
        'layout' => [
            'fields' => [['name' => 'Nom', 'visible' => true, 'order' => 1]],
            'view_id' => $view->id,
            'show_headers_only' => true,
            'per_page' => 25,
        ],
    ];

    $created = $this->actingAs($user)->postJson('/api/v1/reports', $payload);
    $created->assertStatus(201);

    $report = Report::find($created->json('id'));
    expect($report->layout['view_id'])->toBe($view->id);
    expect($report->layout['show_headers_only'])->toBeTrue();
    expect($report->layout['per_page'])->toBe(25);

    // The same keys must also survive an update.
    $otherView = View::factory()->create(['table_id' => $table->id]);
    $payload['layout']['view_id'] = $otherView->id;
    $payload['layout']['per_page'] = 50;

    $this->actingAs($user)
        ->putJson("/api/v1/reports/{$report->id}", $payload)
        ->assertStatus(200);

    $report->refresh();
    expect($report->layout['view_id'])->toBe($otherView->id);
    expect($report->layout['per_page'])->toBe(50);
});

test('csv export emits the group field once when it is also a selected column', function () {
    $setup = createAuthenticatedUser();
    $user = $setup['user'];
    $table = $setup['table'];

    Field::factory()->create(['table_id' => $table->id, 'name' => 'Ville', 'type' => 'text']);
    Field::factory()->create(['table_id' => $table->id, 'name' => 'Nom', 'type' => 'text']);

    Record::create([
        'table_id' => $table->id,
        'data' => ['Ville' => 'Québec', 'Nom' => 'Tremblay'],
        'version' => 1,
    ]);

    $response = $this->actingAs($user)->postJson('/api/v1/reports/preview/csv', [
        'table_id' => $table->id,
        'query' => ['select' => ['Ville', 'Nom'], 'group_by' => 'Ville'],
        'layout' => ['fields' => [
            ['name' => 'Ville', 'visible' => true, 'order' => 1],
            ['name' => 'Nom', 'visible' => true, 'order' => 2],
        ]],
    ]);

    $response->assertStatus(200);
    $csv = $response->streamedContent();
    $headerLine = str_getcsv(explode("\n", trim($csv))[0]);
    $headerLine[0] = preg_replace('/^\x{FEFF}/u', '', $headerLine[0]);

    expect($headerLine)->toBe(['Ville', 'Nom']);
    expect(array_count_values($headerLine)['Ville'])->toBe(1);
});
