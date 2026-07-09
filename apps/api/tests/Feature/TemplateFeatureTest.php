<?php

use App\Models\Database;
use App\Models\Field;
use App\Models\Report;
use App\Models\Table;
use App\Models\User;
use App\Models\View;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

function createWorkspaceOwner(): array
{
    $user = User::factory()->create();
    $workspace = Workspace::factory()->create(['name' => 'Archives privées']);

    WorkspaceMember::factory()->create([
        'user_id' => $user->id,
        'workspace_id' => $workspace->id,
        'role' => 'owner',
    ]);

    return [$user, $workspace];
}

test('user can export a database as a canonical versioned template', function () {
    [$user, $workspace] = createWorkspaceOwner();

    $database = Database::factory()->create([
        'workspace_id' => $workspace->id,
        'name' => 'Catalogue littéraire',
        'locale' => 'fr-CA',
    ]);
    $authors = Table::factory()->create(['database_id' => $database->id, 'name' => 'Authors']);
    $works = Table::factory()->create(['database_id' => $database->id, 'name' => 'Works']);

    $authorName = Field::factory()->create([
        'table_id' => $authors->id,
        'name' => 'name',
        'type' => 'text',
        'position' => 0,
        'options' => ['max_length' => 140],
    ]);
    $title = Field::factory()->create([
        'table_id' => $works->id,
        'name' => 'title',
        'type' => 'text',
        'position' => 0,
    ]);
    Field::factory()->create([
        'table_id' => $works->id,
        'name' => 'author',
        'type' => 'reference',
        'position' => 1,
        'options' => ['target_table' => $authors->id, 'multi' => false],
    ]);

    View::factory()->create([
        'table_id' => $works->id,
        'name' => 'Default card',
        'type' => 'card',
        'config' => [
            'columnCount' => 2,
            'columns' => [
                [$title->id],
                [$authorName->id],
            ],
        ],
    ]);

    Report::forceCreate([
        'id' => (string) Str::uuid(),
        'table_id' => $works->id,
        'name' => 'Annexe B',
        'query' => ['groups' => []],
        'layout' => ['kind' => 'placeholder'],
    ]);

    $response = $this->actingAs($user)
        ->postJson('/api/v1/databases/'.$database->id.'/export-template', [
            'template_version' => '1.2.3',
            'description' => 'Structure publique sans données.',
        ]);

    $response->assertStatus(201)
        ->assertJsonPath('format_version', 1)
        ->assertJsonPath('template_version', '1.2.3')
        ->assertJsonPath('name', 'Catalogue littéraire');

    $payload = $response->json('payload');

    expect($payload['database'])->toMatchArray([
        'name' => 'Catalogue littéraire',
        'locale' => 'fr-CA',
    ]);
    expect($payload['tables'])->toHaveCount(2);
    expect($payload['tables'][0])->toHaveKeys(['key', 'name', 'fields', 'views', 'reports']);
    expect($payload['tables'][0]['key'])->toBe('authors');
    expect($payload['tables'][1]['fields'][1]['options']['target_table'])->toBe('authors');
    expect($payload['tables'][1]['views'][0]['config']['columns'][0][0])->toBe('title');
    expect($payload['tables'][1]['reports'][0]['name'])->toBe('Annexe B');
});

test('installing and exporting a template round-trips to an identical canonical payload', function () {
    [$user, $workspace] = createWorkspaceOwner();

    $template = [
        'format_version' => 1,
        'template_version' => '1.0.0',
        'name' => 'Research archive',
        'description' => 'A small research template.',
        'payload' => [
            'database' => [
                'name' => 'Research archive',
                'locale' => 'fr-CA',
            ],
            'tables' => [
                [
                    'key' => 'authors',
                    'name' => 'Authors',
                    'fields' => [
                        [
                            'key' => 'name',
                            'name' => 'name',
                            'type' => 'text',
                            'position' => 0,
                            'options' => ['max_length' => 140],
                            'validation' => [],
                        ],
                    ],
                    'views' => [],
                    'reports' => [],
                ],
                [
                    'key' => 'works',
                    'name' => 'Works',
                    'fields' => [
                        [
                            'key' => 'title',
                            'name' => 'title',
                            'type' => 'text',
                            'position' => 0,
                            'options' => [],
                            'validation' => [],
                        ],
                        [
                            'key' => 'author',
                            'name' => 'author',
                            'type' => 'reference',
                            'position' => 1,
                            'options' => ['target_table' => 'authors', 'multi' => false],
                            'validation' => [],
                        ],
                    ],
                    'views' => [
                        [
                            'key' => 'default-card',
                            'name' => 'Default card',
                            'type' => 'card',
                            'config' => [
                                'columnCount' => 2,
                                'columns' => [
                                    ['title'],
                                    ['author'],
                                ],
                            ],
                        ],
                    ],
                    'reports' => [
                        [
                            'key' => 'annexe-b',
                            'name' => 'Annexe B',
                            'query' => ['groups' => []],
                            'layout' => ['kind' => 'placeholder'],
                        ],
                    ],
                ],
            ],
            'demo_records' => [],
        ],
    ];

    $installResponse = $this->actingAs($user)
        ->postJson('/api/v1/workspaces/'.$workspace->id.'/install-template', $template);

    $installResponse->assertStatus(201)
        ->assertJsonPath('database.name', 'Research archive');

    $databaseId = $installResponse->json('database.id');

    $exportResponse = $this->actingAs($user)
        ->postJson('/api/v1/databases/'.$databaseId.'/export-template', [
            'template_version' => '1.0.0',
            'description' => 'A small research template.',
        ]);

    $exportResponse->assertStatus(201);
    expect($exportResponse->json('payload'))->toEqual($template['payload']);
});

test('empty database template installs successfully', function () {
    [$user, $workspace] = createWorkspaceOwner();

    $template = [
        'format_version' => 1,
        'template_version' => '1.0.0',
        'name' => 'Empty archive',
        'payload' => [
            'database' => [
                'name' => 'Empty archive',
                'locale' => 'fr-CA',
            ],
            'tables' => [],
            'demo_records' => [],
        ],
    ];

    $installResponse = $this->actingAs($user)
        ->postJson('/api/v1/workspaces/'.$workspace->id.'/install-template', $template);

    $installResponse->assertStatus(201)
        ->assertJsonPath('database.name', 'Empty archive');

    $exportResponse = $this->actingAs($user)
        ->postJson('/api/v1/databases/'.$installResponse->json('database.id').'/export-template', [
            'template_version' => '1.0.0',
        ]);

    $exportResponse->assertStatus(201);
    expect($exportResponse->json('payload'))->toEqual($template['payload']);
});

test('install rejects invalid template format without creating a database', function () {
    [$user, $workspace] = createWorkspaceOwner();

    $response = $this->actingAs($user)
        ->postJson('/api/v1/workspaces/'.$workspace->id.'/install-template', [
            'format_version' => 99,
            'template_version' => '1.0.0',
            'name' => 'Broken template',
            'payload' => [
                'database' => ['name' => 'Broken template'],
                'tables' => [],
            ],
        ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['format_version']);

    $this->assertDatabaseMissing('databases', [
        'name' => 'Broken template',
        'workspace_id' => $workspace->id,
    ]);
});

test('install rejects table definitions without fields without creating a database', function () {
    [$user, $workspace] = createWorkspaceOwner();

    $response = $this->actingAs($user)
        ->postJson('/api/v1/workspaces/'.$workspace->id.'/install-template', [
            'format_version' => 1,
            'template_version' => '1.0.0',
            'name' => 'Malformed template',
            'payload' => [
                'database' => ['name' => 'Malformed template', 'locale' => 'fr-CA'],
                'tables' => [
                    [
                        'key' => 'works',
                        'name' => 'Works',
                    ],
                ],
                'demo_records' => [],
            ],
        ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['payload.tables.0.fields']);

    $this->assertDatabaseMissing('databases', [
        'name' => 'Malformed template',
        'workspace_id' => $workspace->id,
    ]);
});

test('user cannot export or install templates across workspace boundaries', function () {
    [$userA, $workspaceA] = createWorkspaceOwner();
    [$userB, $workspaceB] = createWorkspaceOwner();

    $database = Database::factory()->create([
        'workspace_id' => $workspaceB->id,
        'name' => 'Other workspace database',
    ]);

    $this->actingAs($userA)
        ->postJson('/api/v1/databases/'.$database->id.'/export-template')
        ->assertStatus(403);

    $this->actingAs($userB)
        ->postJson('/api/v1/workspaces/'.$workspaceA->id.'/install-template', [
            'format_version' => 1,
            'template_version' => '1.0.0',
            'name' => 'Unauthorized install',
            'payload' => [
                'database' => ['name' => 'Unauthorized install', 'locale' => 'fr-CA'],
                'tables' => [],
                'demo_records' => [],
            ],
        ])
        ->assertStatus(403);
});

test('unauthorized template requests are rejected before payload validation', function () {
    [$userA, $workspaceA] = createWorkspaceOwner();
    [$userB, $workspaceB] = createWorkspaceOwner();

    $database = Database::factory()->create([
        'workspace_id' => $workspaceB->id,
        'name' => 'Other workspace database',
    ]);

    $this->actingAs($userA)
        ->postJson('/api/v1/databases/'.$database->id.'/export-template', [
            'template_version' => 'not-semver',
        ])
        ->assertStatus(403);

    $this->actingAs($userB)
        ->postJson('/api/v1/workspaces/'.$workspaceA->id.'/install-template', [
            'format_version' => 99,
            'template_version' => 'not-semver',
            'name' => '',
            'payload' => [],
        ])
        ->assertStatus(403);
});

test('non-owner workspace members cannot export or install templates', function () {
    [$owner, $workspace] = createWorkspaceOwner();
    $viewer = User::factory()->create();

    WorkspaceMember::factory()->create([
        'user_id' => $viewer->id,
        'workspace_id' => $workspace->id,
        'role' => 'viewer',
    ]);

    $database = Database::factory()->create([
        'workspace_id' => $workspace->id,
        'name' => 'Owner database',
    ]);

    $this->actingAs($viewer)
        ->postJson('/api/v1/databases/'.$database->id.'/export-template')
        ->assertStatus(403);

    $this->actingAs($viewer)
        ->postJson('/api/v1/workspaces/'.$workspace->id.'/install-template', [
            'format_version' => 1,
            'template_version' => '1.0.0',
            'name' => 'Viewer install',
            'payload' => [
                'database' => ['name' => 'Viewer install', 'locale' => 'fr-CA'],
                'tables' => [],
                'demo_records' => [],
            ],
        ])
        ->assertStatus(403);

    $this->actingAs($owner)
        ->postJson('/api/v1/databases/'.$database->id.'/export-template')
        ->assertStatus(201);
});
