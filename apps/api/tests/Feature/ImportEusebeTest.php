<?php

use App\Models\Database;
use App\Models\Record;
use App\Models\Table;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('artisan command imports eusebe database, normalizes types, maps refs, and generates integrity report', function () {
    // 1. Create a workspace and user
    $user = User::factory()->create();
    $workspace = new Workspace();
    $workspace->id = (string) \Illuminate\Support\Str::uuid();
    $workspace->name = 'Archives de Naomi';
    $workspace->save();

    $member = new WorkspaceMember();
    $member->id = (string) \Illuminate\Support\Str::uuid();
    $member->workspace_id = $workspace->id;
    $member->user_id = $user->id;
    $member->role = 'owner';
    $member->save();

    // Seed templates (Catalogue Littéraire is needed for import)
    $this->seed(\Database\Seeders\TemplateSeeder::class);

    // SQL Dump path
    $sqlPath = '/Users/nao/Eusebe/sql/eusebe.sql';
    expect(File::exists($sqlPath))->toBeTrue("Legacy SQL dump must exist at {$sqlPath}");

    // Delete any existing report to ensure we verify its creation
    $reportPath = base_path('eusebe_import_report.md');
    if (File::exists($reportPath)) {
        File::delete($reportPath);
    }

    // 2. Execute artisan command
    $this->actingAs($user);
    $exitCode = Artisan::call('import:eusebe', [
        'file' => $sqlPath,
        '--workspace' => $workspace->id,
    ]);

    expect($exitCode)->toBe(0, "Command should complete with exit code 0");

    // 3. Verify Database and Tables created
    $database = Database::where('workspace_id', $workspace->id)
        ->where('name', 'Catalogue Littéraire')
        ->firstOrFail();

    $tables = Table::where('database_id', $database->id)->get();
    expect($tables->count())->toBe(13, "Should create all 13 tables of the template");

    // 4. Verify lookup and main records are populated
    $authorsTable = $tables->firstWhere('name', 'Auteurs');
    $worksTable = $tables->firstWhere('name', 'Ouvrages');
    $periodicalsTable = $tables->firstWhere('name', 'Périodiques');
    $printersTable = $tables->firstWhere('name', 'Imprimeurs');
    $publishersTable = $tables->firstWhere('name', 'Éditeurs');
    $frequenciesTable = $tables->firstWhere('name', 'Fréquences');

    $authorRecords = Record::where('table_id', $authorsTable->id)->get();
    $workRecords = Record::where('table_id', $worksTable->id)->get();
    $periodicalRecords = Record::where('table_id', $periodicalsTable->id)->orderBy('rowid', 'asc')->get();

    expect($authorRecords->count())->toBeGreaterThan(0, "Should import author records");
    expect($workRecords->count())->toBeGreaterThan(0, "Should import work records");
    expect($periodicalRecords->count())->toBe(17, "Should import all periodical records");

    // Verify Date normalization
    // In legacy auteurs dump, row 4 'Badeaux' has birth birth '0000-00-00'.
    $badeaux = $authorRecords->first(fn($r) => ($r->data['Nom'] ?? '') === 'Badeaux');
    expect($badeaux)->not->toBeNull("Jean-Baptiste Badeaux should be imported");
    expect($badeaux->data['Naissance'] ?? '')->toBe('unknown', "0000-00-00 date should normalize to 'unknown'");

    // Verify relationship remapping
    // In legacy ouvrages, row 3 is linked to fk_auteur = 4 (Badeaux).
    $journal = $workRecords->first(fn($r) => str_contains($r->data['Titre'] ?? '', 'Journal des opérations'));
    expect($journal)->not->toBeNull("Journal des opérations should be imported");
    expect($journal->data['Auteur'] ?? '')->toBe($badeaux->id, "Work author reference should be remapped to Badeaux's ULID");

    $firstPeriodical = $periodicalRecords->first();
    $senecalPrinter = Record::where('table_id', $printersTable->id)
        ->get()
        ->first(fn ($r) => ($r->data['Nom'] ?? '') === 'Eusèbe Senécal, imprimeur-éditeur');
    $senecalPublisher = Record::where('table_id', $publishersTable->id)
        ->get()
        ->first(fn ($r) => ($r->data['Nom'] ?? '') === 'Eusèbe Senécal, imprimeur-éditeur');
    $weekly = Record::where('table_id', $frequenciesTable->id)
        ->get()
        ->first(fn ($r) => ($r->data['Nom'] ?? '') === 'Hebdomadaire');

    expect($firstPeriodical->data['Titre'] ?? null)->toBeNull("Blank legacy periodical titles should remain blank/null");
    expect($firstPeriodical->data['Propriétaire'] ?? '')->toBe('', "Periodical owner must not be shifted from the date column");
    expect($firstPeriodical->data['Début de parution'] ?? '')->toBe('unknown');
    expect($firstPeriodical->data['Fin de parution'] ?? '')->toBe('unknown');
    expect($firstPeriodical->data['Description'] ?? '')->toBe('');
    expect($firstPeriodical->data['Notes'] ?? '')->toBe('');
    expect($firstPeriodical->data['Imprimeur'] ?? '')->toBe($senecalPrinter?->id);
    expect($firstPeriodical->data['Éditeur'] ?? '')->toBe($senecalPublisher?->id);
    expect($firstPeriodical->data['Fréquence'] ?? '')->toBe($weekly?->id);

    // Verify Image split normalizer
    // Row 15 'Les Soirées du Château de Ramezay' has images 'img/Les belles soirées.jpg~'
    $soirees = $workRecords->first(fn($r) => str_contains($r->data['Titre'] ?? '', 'Château de Ramezay'));
    expect($soirees)->not->toBeNull("Soirées du Château de Ramezay should be imported");
    expect($soirees->data['Images'] ?? '')->not->toBeNull();
    expect($soirees->data['Images']['path'] ?? '')->toBe('img/Les belles soirées.jpg', "Image ~-split list should normalize path");

    // 5. Verify Report Generation
    expect(File::exists($reportPath))->toBeTrue("Integrity report eusebe_import_report.md must be generated");
    
    $reportContent = File::get($reportPath);
    expect($reportContent)->toContain("Eusèbe Sénécal Database Import & Integrity Report");
    expect($reportContent)->toContain("auteurs");
    expect($reportContent)->toContain("ouvrages");

    // Check duplicate candidate detection in the report
    // Clément Arthur Dansereau is duplicate in legacy authors
    expect($reportContent)->toContain("Dansereau");

    // Cleanup
    if (File::exists($reportPath)) {
        File::delete($reportPath);
    }
});
