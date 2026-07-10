<?php

namespace Tests\Parity;

use App\Models\Database;
use App\Models\Record;
use App\Models\Table;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

uses(TestCase::class);

// Global maps to hold resolved data
$setupDone = false;
$legacyToV3IdMap = [];
$databaseId = null;
$workspaceId = null;
$tablesByTemplateKey = [];
$rawSqlRecords = [];

beforeEach(function () use (&$setupDone, &$legacyToV3IdMap, &$databaseId, &$workspaceId, &$tablesByTemplateKey, &$rawSqlRecords) {
    if (! $setupDone) {
        // 1. Run migrations and seed clean slate
        Artisan::call('migrate:fresh');
        Artisan::call('db:seed');

        // 2. Resolve seeded user and workspace
        $user = User::where('email', 'test@example.com')->firstOrFail();
        $member = WorkspaceMember::where('user_id', $user->id)->firstOrFail();
        $workspaceId = $member->workspace_id;

        // 3. Import legacy eusebe database
        $sqlPath = '/Users/nao/Eusebe/sql/eusebe.sql';
        $exitCode = Artisan::call('import:eusebe', [
            'file' => $sqlPath,
            '--workspace' => $workspaceId,
        ]);

        if ($exitCode !== 0) {
            throw new \Exception("Artisan import:eusebe failed with exit code {$exitCode}");
        }

        // 4. Resolve imported database and tables
        $database = Database::where('workspace_id', $workspaceId)
            ->where('name', 'Catalogue Littéraire')
            ->firstOrFail();
        $databaseId = $database->id;

        $tables = Table::where('database_id', $databaseId)->get();

        $tableMapping = [
            'auteurs' => 'authors',
            'categories' => 'categories',
            'editeurs' => 'publishers',
            'frequences' => 'frequencies',
            'imprimeurs' => 'printers',
            'localisations' => 'locations',
            'longueurs' => 'lengths',
            'types' => 'genres',
            'periodiques' => 'periodicals',
            'ouvrages' => 'works',
            'numeros' => 'issues',
            'articles' => 'articles',
        ];

        foreach ($tableMapping as $legacyKey => $templateKey) {
            $tablesByTemplateKey[$legacyKey] = $tables->firstWhere('name', match ($templateKey) {
                'authors' => 'Auteurs',
                'categories' => 'Catégories',
                'publishers' => 'Éditeurs',
                'frequencies' => 'Fréquences',
                'printers' => 'Imprimeurs',
                'locations' => 'Localisations',
                'lengths' => 'Longueurs',
                'genres' => 'Genres',
                'periodicals' => 'Périodiques',
                'works' => 'Ouvrages',
                'issues' => 'Numéros',
                'articles' => 'Articles',
            });
        }

        // 5. Parse SQL dump to build exact legacy ID mapping
        $rawSqlRecords = parseSqlFile($sqlPath);

        // Build mapping: $legacyToV3IdMap[tableName][legacyId] = v3ULID
        foreach ($tableMapping as $legacyTable => $templateKey) {
            $tableModel = $tablesByTemplateKey[$legacyTable] ?? null;
            if (! $tableModel) {
                continue;
            }

            $dbRecords = Record::where('table_id', $tableModel->id)->orderBy('rowid', 'asc')->get();
            $legacyRows = $rawSqlRecords[$legacyTable] ?? [];

            $legacyToV3IdMap[$legacyTable] = [];
            foreach ($legacyRows as $index => $row) {
                $legacyId = $row[0] ?? null;
                $v3Record = $dbRecords->get($index);
                if ($legacyId && $v3Record) {
                    $legacyToV3IdMap[$legacyTable][$legacyId] = $v3Record->id;
                }
            }
        }
        $setupDone = true;
    }

    $user = User::where('email', 'test@example.com')->firstOrFail();
    $this->actingAs($user);
});

// ---------------------------------------------------------------------------
// SQL Parser Helpers (Replicated from ImportEusebe.php)
// ---------------------------------------------------------------------------

function parseSqlFile(string $path): array
{
    $rawRecords = [];
    $handle = fopen($path, 'r');
    if (! $handle) {
        return [];
    }

    while (($line = fgets($handle)) !== false) {
        $line = trim($line);
        if (empty($line) || ! str_starts_with($line, 'INSERT INTO')) {
            continue;
        }

        if (preg_match('/^INSERT INTO `([a-zA-Z0-9_]+)` VALUES/i', $line, $matches)) {
            $tableName = $matches[1];
            $valuesOffset = strpos($line, 'VALUES') + 6;
            $valuesStr = substr($line, $valuesOffset);
            $valuesStr = rtrim($valuesStr, ';');

            $parsedRows = parseInsertValues($valuesStr);
            if (! isset($rawRecords[$tableName])) {
                $rawRecords[$tableName] = [];
            }
            $rawRecords[$tableName] = array_merge($rawRecords[$tableName], $parsedRows);
        }
    }
    fclose($handle);

    return $rawRecords;
}

function parseInsertValues(string $valuesStr): array
{
    $rows = [];
    $len = strlen($valuesStr);
    $i = 0;

    while ($i < $len) {
        while ($i < $len && $valuesStr[$i] !== '(') {
            $i++;
        }
        if ($i >= $len) {
            break;
        }
        $i++; // Skip '('

        $row = [];
        $currentVal = '';
        $inString = false;
        $escape = false;

        while ($i < $len) {
            $char = $valuesStr[$i];

            if ($inString) {
                if ($escape) {
                    if ($char === 'r') {
                        $currentVal .= "\r";
                    } elseif ($char === 'n') {
                        $currentVal .= "\n";
                    } elseif ($char === 't') {
                        $currentVal .= "\t";
                    } else {
                        $currentVal .= $char;
                    }
                    $escape = false;
                } elseif ($char === '\\') {
                    $escape = true;
                } elseif ($char === "'") {
                    $inString = false;
                } else {
                    $currentVal .= $char;
                }
            } else {
                if ($char === "'") {
                    $inString = true;
                } elseif ($char === ',') {
                    $row[] = trim($currentVal) === 'NULL' ? null : $currentVal;
                    $currentVal = '';
                } elseif ($char === ')') {
                    $row[] = trim($currentVal) === 'NULL' ? null : $currentVal;
                    $rows[] = $row;
                    $i++; // Skip ')'
                    break;
                } else {
                    $currentVal .= $char;
                }
            }
            $i++;
        }
    }

    return $rows;
}

function recordsUrl(string $tableId, array $params = []): string
{
    return '/api/v1/records?'.http_build_query(['table_id' => $tableId] + $params);
}

function normalizeParityText(?string $value): string
{
    $normalized = preg_replace('/\s+/', ' ', trim((string) $value));
    $normalized = preg_replace('/\s+(?=<\/)/', '', $normalized);

    return preg_replace('/\s+,/', ',', $normalized);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('read contract: dashboard counts match exactly', function () use (&$tablesByTemplateKey) {
    $golden = json_decode(File::get(base_path('../../tests/parity/golden/dashboard.json')), true);

    $auteursTable = $tablesByTemplateKey['auteurs'];
    $ouvragesTable = $tablesByTemplateKey['ouvrages'];
    $periodiquesTable = $tablesByTemplateKey['periodiques'];

    // Call API /records endpoint for each table and check total
    $auteursResponse = $this->getJson("/api/v1/records?table_id={$auteursTable->id}&per_page=1");
    $ouvragesResponse = $this->getJson("/api/v1/records?table_id={$ouvragesTable->id}&per_page=1");
    $periodiquesResponse = $this->getJson("/api/v1/records?table_id={$periodiquesTable->id}&per_page=1");

    expect($auteursResponse->json('pagination.total'))->toBe($golden['counts']['auteurs']);
    expect($ouvragesResponse->json('pagination.total'))->toBe($golden['counts']['ouvrages']);
    expect($periodiquesResponse->json('pagination.total'))->toBe($golden['counts']['periodiques']);
});

test('read contract: browse periodiques by title', function () use (&$tablesByTemplateKey, &$legacyToV3IdMap) {
    $golden = json_decode(File::get(base_path('../../tests/parity/golden/browse_periodique_titre.json')), true);
    $table = $tablesByTemplateKey['periodiques'];

    $response = $this->getJson("/api/v1/records?table_id={$table->id}&sort=Titre&sort_dir=asc&per_page=100");
    $data = $response->json('data');

    expect(count($data))->toBe(count($golden['entries']));

    // Match set of records with normalized whitespace
    $v3Titles = collect($data)->map(fn ($r) => preg_replace('/\s+/', ' ', trim($r['data']['Titre'] ?? '')))->sort()->values()->all();
    $goldenTitles = collect($golden['entries'])->map(fn ($e) => preg_replace('/\s+/', ' ', trim($e['titre'] ?? '')))->sort()->values()->all();
    expect($v3Titles)->toEqual($goldenTitles);

    // Verify remapped ID correspondence
    $goldenByTitle = collect($golden['entries'])->groupBy(fn ($entry) => normalizeParityText($entry['titre'] ?? ''));
    $v3ByTitle = collect($data)->groupBy(fn ($record) => normalizeParityText($record['data']['Titre'] ?? ''));

    foreach ($goldenByTitle as $title => $goldenEntries) {
        $expectedV3Ids = $goldenEntries
            ->map(fn ($entry) => $legacyToV3IdMap['periodiques'][$entry['id']] ?? null)
            ->filter()
            ->sort()
            ->values()
            ->all();
        $actualV3Ids = ($v3ByTitle[$title] ?? collect())
            ->pluck('id')
            ->sort()
            ->values()
            ->all();

        expect($actualV3Ids)->toBe($expectedV3Ids);
    }
});

test('read contract: browse ouvrages by title', function () use (&$tablesByTemplateKey, &$legacyToV3IdMap) {
    $golden = json_decode(File::get(base_path('../../tests/parity/golden/browse_ouvrage_titre.json')), true);
    $table = $tablesByTemplateKey['ouvrages'];

    $response = $this->getJson("/api/v1/records?table_id={$table->id}&sort=Titre&sort_dir=asc&per_page=500");
    $data = $response->json('data');

    expect(count($data))->toBe(count($golden['entries']));

    // Match set of titles with normalized whitespace
    $v3Titles = collect($data)->map(fn ($r) => preg_replace('/\s+/', ' ', trim($r['data']['Titre'] ?? '')))->sort()->values()->all();
    $goldenTitles = collect($golden['entries'])->map(fn ($e) => preg_replace('/\s+/', ' ', trim($e['titre'] ?? '')))->sort()->values()->all();
    expect($v3Titles)->toEqual($goldenTitles);
});

test('read contract: browse ouvrages by author', function () use (&$tablesByTemplateKey, &$legacyToV3IdMap) {
    $golden = json_decode(File::get(base_path('../../tests/parity/golden/browse_ouvrage_auteurs.json')), true);
    $worksTable = $tablesByTemplateKey['ouvrages'];
    $authorsTable = $tablesByTemplateKey['auteurs'];

    $authors = Record::where('table_id', $authorsTable->id)->get();

    $authorLabelForRecord = function ($rec): string {
        $nom = $rec->data['Nom'] ?? '';
        $prenom = $rec->data['Prénom'] ?? '';
        if ($prenom === 'Auteur inconnu') {
            $formatted = 'Auteur inconnu';
        } elseif ($nom === '') {
            $formatted = ', '.$prenom;
        } else {
            $formatted = $nom.', '.$prenom;
        }

        return normalizeParityText($formatted);
    };

    $authorsByLabel = $authors->groupBy($authorLabelForRecord);
    $goldenByLabel = collect($golden['dimensions'])->groupBy(fn ($dim) => normalizeParityText(preg_replace('/\s*\(\d+\)$/', '', $dim['value'])));

    foreach ($goldenByLabel as $authorLabel => $dimensions) {
        $authorRecords = $authorsByLabel[$authorLabel] ?? collect();
        expect($authorRecords->count())->toBeGreaterThan(0, "Author {$authorLabel} should exist in v3 database");

        $data = collect();

        foreach ($authorRecords as $authorRecord) {
            // Fetch works for this author sorted by Titre
            $response = $this->getJson(recordsUrl($worksTable->id, [
                'filters' => json_encode([[
                    'field' => 'Auteur',
                    'operator' => 'eq',
                    'value' => $authorRecord->id,
                ]]),
                'sort' => 'Titre',
                'sort_dir' => 'asc',
                'per_page' => 500,
            ]));
            $data = $data->merge($response->json('data'));
        }

        $goldenEntries = $dimensions->flatMap(fn ($dim) => $dim['entries']);
        $this->assertSame($goldenEntries->count(), $data->count(), "Work count mismatch for author {$authorLabel}");

        $v3Titles = collect($data)->map(fn ($r) => preg_replace('/\s+/', ' ', trim($r['data']['Titre'] ?? '')))->sort()->values()->all();
        $goldenTitles = $goldenEntries->map(fn ($e) => preg_replace('/\s+/', ' ', trim($e['titre'] ?? '')))->sort()->values()->all();
        expect($v3Titles)->toEqual($goldenTitles);
    }
});

test('read contract: browse ouvrages by publication year', function () use (&$tablesByTemplateKey) {
    $golden = json_decode(File::get(base_path('../../tests/parity/golden/browse_ouvrage_dates.json')), true);
    $table = $tablesByTemplateKey['ouvrages'];

    foreach ($golden['dimensions'] as $dim) {
        $yearVal = $dim['value'] === 'Inconnu' ? 0 : (int) $dim['value'];

        $response = $this->getJson(recordsUrl($table->id, [
            'filters' => json_encode([[
                'field' => 'Année de publication',
                'operator' => 'eq',
                'value' => $yearVal,
            ]]),
            'sort' => 'Titre',
            'sort_dir' => 'asc',
            'per_page' => 200,
        ]));
        $data = $response->json('data');

        expect(count($data))->toBe(count($dim['entries']));

        $v3Titles = collect($data)->map(fn ($r) => preg_replace('/\s+/', ' ', trim($r['data']['Titre'] ?? '')))->sort()->values()->all();
        $goldenTitles = collect($dim['entries'])->map(fn ($e) => preg_replace('/\s+/', ' ', trim($e['titre'] ?? '')))->sort()->values()->all();
        expect($v3Titles)->toEqual($goldenTitles);
    }
});

test('read contract: browse ouvrages by genre', function () use (&$tablesByTemplateKey) {
    $golden = json_decode(File::get(base_path('../../tests/parity/golden/browse_ouvrage_genre.json')), true);
    $worksTable = $tablesByTemplateKey['ouvrages'];
    $genresTable = $tablesByTemplateKey['types'];

    $genres = Record::where('table_id', $genresTable->id)->get();

    foreach ($golden['dimensions'] as $dim) {
        $genreLabel = preg_replace('/\s*\(\d+\)$/', '', $dim['value']);
        $genreRecord = $genres->first(fn ($r) => trim($r->data['Nom'] ?? '') === trim($genreLabel));
        expect($genreRecord)->not->toBeNull("Genre {$genreLabel} should exist");

        $response = $this->getJson(recordsUrl($worksTable->id, [
            'filters' => json_encode([[
                'field' => 'Genre',
                'operator' => 'eq',
                'value' => $genreRecord->id,
            ]]),
            'sort' => 'Titre',
            'sort_dir' => 'asc',
            'per_page' => 500,
        ]));
        $data = $response->json('data');

        expect(count($data))->toBe(count($dim['entries']));

        $v3Titles = collect($data)->map(fn ($r) => preg_replace('/\s+/', ' ', trim($r['data']['Titre'] ?? '')))->sort()->values()->all();
        $goldenTitles = collect($dim['entries'])->map(fn ($e) => preg_replace('/\s+/', ' ', trim($e['titre'] ?? '')))->sort()->values()->all();
        expect($v3Titles)->toEqual($goldenTitles);
    }
});

test('read contract: browse ouvrages by category', function () use (&$tablesByTemplateKey) {
    $golden = json_decode(File::get(base_path('../../tests/parity/golden/browse_ouvrage_categorie.json')), true);
    $worksTable = $tablesByTemplateKey['ouvrages'];
    $categoriesTable = $tablesByTemplateKey['categories'];

    $categories = Record::where('table_id', $categoriesTable->id)->get();

    foreach ($golden['dimensions'] as $dim) {
        $catLabel = preg_replace('/\s*\(\d+\)$/', '', $dim['value']);
        $catRecord = $categories->first(fn ($r) => trim($r->data['Nom'] ?? '') === trim($catLabel));
        expect($catRecord)->not->toBeNull("Category {$catLabel} should exist");

        $response = $this->getJson(recordsUrl($worksTable->id, [
            'filters' => json_encode([[
                'field' => 'Catégorie',
                'operator' => 'eq',
                'value' => $catRecord->id,
            ]]),
            'sort' => 'Titre',
            'sort_dir' => 'asc',
            'per_page' => 500,
        ]));
        $data = $response->json('data');

        expect(count($data))->toBe(count($dim['entries']));

        $v3Titles = collect($data)->map(fn ($r) => preg_replace('/\s+/', ' ', trim($r['data']['Titre'] ?? '')))->sort()->values()->all();
        $goldenTitles = collect($dim['entries'])->map(fn ($e) => preg_replace('/\s+/', ' ', trim($e['titre'] ?? '')))->sort()->values()->all();
        expect($v3Titles)->toEqual($goldenTitles);
    }
});

test('read contract: details of periodiques', function () use (&$tablesByTemplateKey, &$legacyToV3IdMap) {
    $golden = json_decode(File::get(base_path('../../tests/parity/golden/detail_periodiques.json')), true);

    foreach ($golden['records'] as $goldRec) {
        $v3Id = $legacyToV3IdMap['periodiques'][$goldRec['id']] ?? null;
        expect($v3Id)->not->toBeNull("Periodical ID {$goldRec['id']} should map to v3 ULID");

        $response = $this->getJson("/api/v1/records/{$v3Id}");
        $rec = $response->json('data');

        expect(preg_replace('/\s+/', ' ', trim($rec['Titre'] ?? '')))
            ->toBe(preg_replace('/\s+/', ' ', trim($goldRec['fields']['titre'] ?? '')));

        // Check description mapping
        if (isset($goldRec['fields']['Description'])) {
            expect(preg_replace('/\s+/', ' ', trim($rec['Description'] ?? '')))
                ->toBe(preg_replace('/\s+/', ' ', trim($goldRec['fields']['Description'] ?? '')));
        }

        // Check notes mapping
        if (isset($goldRec['fields']['Notes'])) {
            expect(preg_replace('/\s+/', ' ', trim($rec['Notes'] ?? '')))
                ->toBe(preg_replace('/\s+/', ' ', trim($goldRec['fields']['Notes'] ?? '')));
        }
    }
});

test('read contract: details of ouvrages', function () use (&$tablesByTemplateKey, &$legacyToV3IdMap) {
    $golden = json_decode(File::get(base_path('../../tests/parity/golden/detail_ouvrages.json')), true);

    foreach ($golden['records'] as $goldRec) {
        $v3Id = $legacyToV3IdMap['ouvrages'][$goldRec['id']] ?? null;
        expect($v3Id)->not->toBeNull("Ouvrage ID {$goldRec['id']} should map to v3 ULID");

        $response = $this->getJson("/api/v1/records/{$v3Id}");
        $rec = $response->json('data');

        expect(preg_replace('/\s+/', ' ', trim($rec['Titre'] ?? '')))
            ->toBe(preg_replace('/\s+/', ' ', trim($goldRec['fields']['titre'] ?? '')));

        // Check page count mapping
        if (isset($goldRec['fields']['Nombre de pages'])) {
            expect((int) ($rec['Nombre de pages'] ?? 0))->toBe((int) $goldRec['fields']['Nombre de pages']);
        }
    }
});

test('read contract: loadchoices verbatim lookups mapping', function () use (&$tablesByTemplateKey) {
    $golden = json_decode(File::get(base_path('../../tests/parity/golden/loadchoices.json')), true);

    $mapping = [
        'auteur' => 'auteurs',
        'type' => 'types',
        'categorie' => 'categories',
        'editeur' => 'editeurs',
        'imprimeur' => 'imprimeurs',
        'localisation' => 'localisations',
        'frequence' => 'frequences',
    ];

    foreach ($mapping as $choiceKey => $legacyTable) {
        $table = $tablesByTemplateKey[$legacyTable];

        $response = $this->getJson("/api/v1/records?table_id={$table->id}&per_page=1000");
        $data = $response->json('data');

        $goldenList = $golden[$choiceKey];
        expect(count($data))->toBe(count($goldenList));
    }
});

test('read contract: annex structure validation', function () use (&$tablesByTemplateKey, &$legacyToV3IdMap) {
    $golden = json_decode(File::get(base_path('../../tests/parity/golden/annex.json')), true);

    $worksTable = $tablesByTemplateKey['ouvrages'];
    $authorsTable = $tablesByTemplateKey['auteurs'];
    $imprimeursTable = $tablesByTemplateKey['imprimeurs'];
    $editeursTable = $tablesByTemplateKey['editeurs'];

    // Load all records in memory for resolution
    $works = Record::where('table_id', $worksTable->id)->get();
    $authors = Record::where('table_id', $authorsTable->id)->get()->keyBy('id');
    $imprimeurs = Record::where('table_id', $imprimeursTable->id)->get()->keyBy('id');
    $editeurs = Record::where('table_id', $editeursTable->id)->get()->keyBy('id');

    $v3ToLegacyIdMap = array_flip($legacyToV3IdMap['ouvrages'] ?? []);

    // Group works by publication year
    $groupedWorks = $works->groupBy(function ($rec) {
        $yr = $rec->data['Année de publication'] ?? 0;

        return $yr === 0 ? 'Inconnu' : (string) $yr;
    });

    // Sort the year groups ASC, keeping Inconnu first
    $groupedWorks = $groupedWorks->sortBy(fn ($val, $key) => $key === 'Inconnu' ? -1 : (int) $key);

    expect(count($groupedWorks))->toBe($golden['groupCount']);

    foreach ($golden['groups'] as $goldGroup) {
        $year = $goldGroup['year'];
        $worksInYear = $groupedWorks->get($year);
        expect($worksInYear)->not->toBeNull("Works for year {$year} should exist");

        // Sort works by author Nom, then author Prénom, then legacy ID ASC
        $worksInYear = $worksInYear->sort(function ($a, $b) use ($authors, $v3ToLegacyIdMap) {
            $aAuth = $a->data['Auteur'] ? $authors->get($a->data['Auteur']) : null;
            $bAuth = $b->data['Auteur'] ? $authors->get($b->data['Auteur']) : null;

            $aNom = strtolower($aAuth->data['Nom'] ?? '');
            $bNom = strtolower($bAuth->data['Nom'] ?? '');
            if ($aNom !== $bNom) {
                return strcmp($aNom, $bNom);
            }

            $aPrenom = strtolower($aAuth->data['Prénom'] ?? '');
            $bPrenom = strtolower($bAuth->data['Prénom'] ?? '');
            if ($aPrenom !== $bPrenom) {
                return strcmp($aPrenom, $bPrenom);
            }

            $aLegacyId = (int) ($v3ToLegacyIdMap[$a->id] ?? 0);
            $bLegacyId = (int) ($v3ToLegacyIdMap[$b->id] ?? 0);

            return $aLegacyId - $bLegacyId;
        })->values();

        expect($worksInYear->count())->toBe(count($goldGroup['entries']));

        $v3Rows = $worksInYear->map(function ($work) use ($authors, $imprimeurs, $editeurs) {
            // Resolve references
            $authorRec = $work->data['Auteur'] ? $authors->get($work->data['Auteur']) : null;
            $imprimeurRec = $work->data['Imprimeur'] ? $imprimeurs->get($work->data['Imprimeur']) : null;
            $editeurRec = $work->data['Éditeur'] ? $editeurs->get($work->data['Éditeur']) : null;

            $nom = $authorRec->data['Nom'] ?? '';
            $prenom = $authorRec->data['Prénom'] ?? '';

            // Reconstruct raw string
            $authorRaw = ($nom !== '') ? $nom.' , '.$prenom : $prenom;
            $expectedRaw = $authorRaw.', '.($work->data['Titre'] ?? '').', '.($work->data['Nombre de pages'] ?? '0').' pages, Imprimeur: '.($imprimeurRec->data['Nom'] ?? '').', Éditeur: '.($editeurRec->data['Nom'] ?? '');

            return normalizeParityText(strip_tags($expectedRaw));
        })->sort()->values()->all();

        $goldenRows = collect($goldGroup['entries'])
            ->map(fn ($entry) => normalizeParityText(strip_tags($entry['raw'])))
            ->sort()
            ->values()
            ->all();

        expect($v3Rows)->toBe($goldenRows);
    }
});

test('write contracts: create, edit, and delete records via API with DB assertions', function () use (&$tablesByTemplateKey) {
    $authorsTable = $tablesByTemplateKey['auteurs'];

    // 1. Create a record via POST
    $createResponse = $this->postJson('/api/v1/records', [
        'table_id' => $authorsTable->id,
        'data' => [
            'Nom' => 'Voltaire',
            'Prénom' => 'François-Marie Arouet',
            'Naissance' => '1694-11-21',
            'Décès' => '1778-05-30',
        ],
    ]);

    $createResponse->assertStatus(201);
    $newRecordId = $createResponse->json('id');
    expect($newRecordId)->not->toBeNull();

    // DB Assert: verify stored in records table
    $this->assertDatabaseHas('records', [
        'id' => $newRecordId,
        'table_id' => $authorsTable->id,
    ]);

    $storedRecord = Record::findOrFail($newRecordId);
    expect($storedRecord->data['Nom'])->toBe('Voltaire');
    expect($storedRecord->data['Prénom'])->toBe('François-Marie Arouet');

    // 2. Edit the record via PUT
    $updateResponse = $this->putJson("/api/v1/records/{$newRecordId}", [
        'data' => [
            'Nom' => 'Voltaire',
            'Prénom' => 'François-Marie',
            'Naissance' => '1694-11-21',
            'Décès' => '1778-05-30',
            'Notice biographique URL' => 'https://fr.wikipedia.org/wiki/Voltaire',
        ],
    ]);

    $updateResponse->assertStatus(200);

    // DB Assert: verify update took place in database
    $updatedRecord = Record::findOrFail($newRecordId);
    expect($updatedRecord->data['Prénom'])->toBe('François-Marie');
    expect($updatedRecord->data['Notice biographique URL'] ?? '')->toBe('https://fr.wikipedia.org/wiki/Voltaire');

    // 3. Delete the record via DELETE (Purge / Permanent delete)
    $deleteResponse = $this->deleteJson("/api/v1/records/{$newRecordId}/purge");
    $deleteResponse->assertStatus(204);

    // DB Assert: verify record is deleted from DB
    $this->assertDatabaseMissing('records', [
        'id' => $newRecordId,
    ]);
});
