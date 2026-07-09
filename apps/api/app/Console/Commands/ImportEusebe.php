<?php

namespace App\Console\Commands;

use App\Models\Database;
use App\Models\Field;
use App\Models\Record;
use App\Models\Table;
use App\Models\Template;
use App\Models\Workspace;
use App\Services\RecordActivityService;
use App\Services\RecordLinkService;
use App\Services\RecordValidationService;
use App\Services\TemplateInstallService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\Uid\Ulid;

class ImportEusebe extends Command
{
    protected $signature = 'import:eusebe 
                            {file=/Users/nao/Eusebe/sql/eusebe.sql : Path to the eusebe.sql file} 
                            {--workspace= : Target Workspace UUID}';

    protected $description = 'Import legacy Eusèbe Sénécal MySQL dump into the modern dynamic database schema';

    private array $tableMapping = [
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

    private array $columnMappings = [
        'auteurs' => ['id', 'nom', 'prenom', 'naissance', 'deces', 'lien'],
        'categories' => ['id', 'nom'],
        'editeurs' => ['id', 'nom'],
        'frequences' => ['id', 'nom'],
        'imprimeurs' => ['id', 'nom'],
        'localisations' => ['id', 'nom'],
        'longueurs' => ['id', 'nom'],
        'types' => ['id', 'nom'],
        'periodiques' => ['id', 'titre', 'fk_imprimeur', 'fk_editeur', 'fk_frequence', 'proprietaire', 'debut', 'fin', 'description_courte', 'description', 'images', 'notes'],
        'ouvrages' => ['id', 'titre', 'description', 'description_courte', 'images', 'annee_publication', 'fk_auteur', 'fk_type', 'fk_cat', 'mois_publication', 'nombre_pages', 'fk_editeur', 'fk_imprimeur', 'nombre_editions', 'fk_local', 'notes'],
        'numeros' => ['id', 'code', 'date', 'publicite', 'localisation', 'fk_periodique'],
        'articles' => ['id', 'titre', 'fk_auteur', 'description', 'description_courte', 'fk_numero', 'illustrations', 'fk_longueur', 'quantite_longueur', 'de', 'a', 'consultation', 'images'],
    ];

    private array $fieldMappings = [
        'auteurs' => [
            'nom' => 'nom',
            'prenom' => 'prenom',
            'naissance' => 'naissance',
            'deces' => 'deces',
            'lien' => 'lien',
        ],
        'categories' => [
            'nom' => 'nom',
        ],
        'editeurs' => [
            'nom' => 'nom',
        ],
        'frequences' => [
            'nom' => 'nom',
        ],
        'imprimeurs' => [
            'nom' => 'nom',
        ],
        'localisations' => [
            'nom' => 'nom',
        ],
        'longueurs' => [
            'nom' => 'nom',
        ],
        'types' => [
            'nom' => 'nom',
        ],
        'periodiques' => [
            'titre' => 'titre',
            'fk_imprimeur' => 'imprimeur',
            'fk_editeur' => 'editeur',
            'fk_frequence' => 'frequence',
            'proprietaire' => 'proprietaire',
            'debut' => 'debut',
            'fin' => 'fin',
            'description_courte' => 'description_courte',
            'description' => 'description',
            'images' => 'images',
            'notes' => 'notes',
        ],
        'ouvrages' => [
            'titre' => 'titre',
            'description' => 'description',
            'description_courte' => 'description_courte',
            'images' => 'images',
            'annee_publication' => 'annee_publication',
            'fk_auteur' => 'auteur',
            'fk_type' => 'type',
            'fk_cat' => 'categorie',
            'mois_publication' => 'mois_publication',
            'nombre_pages' => 'nombre_pages',
            'fk_editeur' => 'editeur',
            'fk_imprimeur' => 'imprimeur',
            'nombre_editions' => 'nombre_editions',
            'fk_local' => 'localisation',
            'notes' => 'notes',
        ],
        'numeros' => [
            'code' => 'code',
            'date' => 'date',
            'publicite' => 'publicite',
            'localisation' => 'localisation',
            'fk_periodique' => 'periodique',
        ],
        'articles' => [
            'titre' => 'titre',
            'fk_auteur' => 'auteur',
            'description' => 'description',
            'description_courte' => 'description_courte',
            'fk_numero' => 'numero',
            'fk_longueur' => 'longueur',
            'quantite_longueur' => 'quantite_longueur',
            'de' => 'de',
            'a' => 'a',
            'consultation' => 'consultation',
            'images' => 'images',
        ],
    ];

    private array $referenceFields = [
        'periodiques' => [
            'fk_imprimeur' => 'imprimeurs',
            'fk_editeur' => 'editeurs',
            'fk_frequence' => 'frequences',
        ],
        'ouvrages' => [
            'fk_auteur' => 'auteurs',
            'fk_type' => 'types',
            'fk_cat' => 'categories',
            'fk_editeur' => 'editeurs',
            'fk_imprimeur' => 'imprimeurs',
            'fk_local' => 'localisations',
        ],
        'numeros' => [
            'fk_periodique' => 'periodiques',
        ],
        'articles' => [
            'fk_auteur' => 'auteurs',
            'fk_numero' => 'numeros',
            'fk_longueur' => 'longueurs',
        ],
    ];

    public function __construct(
        private TemplateInstallService $templateInstallService,
        private RecordValidationService $recordValidationService,
        private RecordLinkService $recordLinkService,
        private RecordActivityService $recordActivityService,
    ) {
        parent::__construct();
    }

    public function handle(): int
    {
        $sqlPath = $this->argument('file');
        if (!file_exists($sqlPath)) {
            $this->error("SQL file not found at: {$sqlPath}");
            return 1;
        }

        // Get or create workspace
        $workspaceId = $this->option('workspace');
        if ($workspaceId) {
            $workspace = Workspace::findOrFail($workspaceId);
        } else {
            $workspace = Workspace::where('name', 'Mon espace de travail')->first()
                ?? Workspace::first()
                ?? Workspace::create(['id' => (string) Str::uuid(), 'name' => 'Auto Workspace']);
        }

        $this->info("Target Workspace: {$workspace->name} ({$workspace->id})");
        $this->info("Parsing SQL file...");

        $rawRecords = $this->parseSqlFile($sqlPath);
        if (empty($rawRecords)) {
            $this->error("No insert statements found in SQL file.");
            return 1;
        }

        $this->info("Installing Literary Catalog template...");
        $template = Template::where('name', 'Catalogue Littéraire')->firstOrFail();

        $payload = $template->payload;
        unset($payload['demo_records']);

        $result = $this->templateInstallService->install($workspace, [
            'format_version' => $template->format_version,
            'template_version' => $template->template_version,
            'name' => 'Eusèbe Sénécal (Importé)',
            'payload' => $payload,
        ]);

        $database = $result['database'];
        $this->info("Database created: {$database->name} ({$database->id})");

        // Load tables
        $tables = Table::with('fields')->where('database_id', $database->id)->get();
        $tablesByTemplateKey = [];
        $fieldKeyToName = [];

        foreach ($tables as $tbl) {
            // Find key in payload tables
            $tableDef = collect($template->payload['tables'])->firstWhere('name', $tbl->name);
            if ($tableDef) {
                $tablesByTemplateKey[$tableDef['key']] = $tbl;
                $fieldKeyToName[$tableDef['key']] = [];
                foreach ($tableDef['fields'] as $fDef) {
                    $fieldKeyToName[$tableDef['key']][$fDef['key']] = $fDef['name'];
                }
            }
        }

        $this->info("Importing records...");

        $idMappings = []; // [legacyTable => [legacyIntId => realUlid]]
        $importStats = [];
        $warnings = [];
        $duplicateCandidates = [];

        DB::beginTransaction();

        try {
            // Topological order to seed lookups first
            $order = [
                'auteurs',
                'categories',
                'editeurs',
                'frequences',
                'imprimeurs',
                'localisations',
                'longueurs',
                'types',
                'periodiques',
                'ouvrages',
                'numeros',
                'articles',
            ];

            foreach ($order as $legacyTable) {
                if (!isset($rawRecords[$legacyTable])) {
                    continue;
                }

                $templateKey = $this->tableMapping[$legacyTable];
                $tableModel = $tablesByTemplateKey[$templateKey] ?? null;
                if (!$tableModel) {
                    $this->warn("Table model not found for: {$templateKey}");
                    continue;
                }

                $columnList = $this->columnMappings[$legacyTable];
                $fieldList = $this->fieldMappings[$legacyTable];
                $refs = $this->referenceFields[$legacyTable] ?? [];

                $importStats[$legacyTable] = 0;
                $idMappings[$legacyTable] = [];

                foreach ($rawRecords[$legacyTable] as $row) {
                    // Map arrays to named arrays
                    $legacyData = [];
                    foreach ($columnList as $idx => $colName) {
                        $legacyData[$colName] = $row[$idx] ?? null;
                    }

                    $legacyId = $legacyData['id'] ?? null;
                    if (!$legacyId) {
                        continue;
                    }

                    $realId = (string) new Ulid();
                    $idMappings[$legacyTable][$legacyId] = $realId;

                    $recordData = [];
                    foreach ($fieldList as $colName => $fieldKey) {
                        $value = $legacyData[$colName] ?? null;
                        $actualFieldName = $fieldKeyToName[$templateKey][$fieldKey] ?? null;
                        $fieldModel = $actualFieldName ? $tableModel->fields->firstWhere('name', $actualFieldName) : null;
                        
                        // Handle date conversions
                        if ($fieldModel?->type === 'date') {
                            $value = $this->normalizeDate($value);
                        }

                        // Handle image lists split by ~
                        if ($fieldModel?->type === 'image') {
                            $isMulti = ($fieldModel->options['multi'] ?? false) === true;
                            $value = $this->normalizeImages($value, $isMulti);
                        }

                        // Handle reference remapping
                        if ($fieldModel?->type === 'reference') {
                            $targetTable = $refs[$colName] ?? null;
                            if ($targetTable && $value !== null && $value !== '') {
                                $value = $idMappings[$targetTable][$value] ?? null;
                                if (!$value) {
                                    $warnings[] = [
                                        'table' => $legacyTable,
                                        'id' => $legacyId,
                                        'type' => 'broken_reference',
                                        'message' => "Reference to legacy {$targetTable} ID {$legacyData[$colName]} could not be resolved.",
                                    ];
                                }
                            }
                        }

                        // Safe bio link url check
                        if ($fieldKey === 'lien' && $legacyTable === 'auteurs' && $value) {
                            if (!str_starts_with($value, 'http')) {
                                $value = null; // Prevent URL validation failure on short string
                            }
                        }

                        // Cast boolean for illustrations
                        if ($colName === 'illustrations' && $value !== null) {
                            $value = (bool) $value;
                        }

                        if ($value !== null && $actualFieldName) {
                            $recordData[$actualFieldName] = $value;
                        }
                    }

                    // Validate against dynamic schema
                    $valResult = $this->recordValidationService->validate($tableModel, $recordData);
                    if (!$valResult['valid']) {
                        $errorMsg = [];
                        foreach ($valResult['errors'] as $field => $errs) {
                            $errorMsg[] = "{$field}: " . implode(', ', $errs);
                        }
                        $warnings[] = [
                            'table' => $legacyTable,
                            'id' => $legacyId,
                            'type' => 'validation_error',
                            'message' => implode('; ', $errorMsg),
                        ];
                    }

                    // Direct Eloquent save to bypass mass assignment
                    $record = new Record();
                    $record->id = $realId;
                    $record->table_id = $tableModel->id;
                    $record->data = $this->recordValidationService->normalize($tableModel, $recordData);
                    $record->version = 1;
                    $record->save();

                    // Sync database link records
                    $this->recordLinkService->syncLinks($record);

                    $importStats[$legacyTable]++;
                }
            }

            // Perform duplicate checks
            $duplicateCandidates = $this->checkDuplicates($database, $tablesByTemplateKey);

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            $this->error("Transaction aborted due to error: " . $e->getMessage());
            $this->error($e->getTraceAsString());
            return 1;
        }

        $this->info("Import completed successfully!");

        // Print stats
        $this->info("\n--- Import Summary ---");
        foreach ($importStats as $tbl => $count) {
            $this->line("{$tbl}: {$count} records imported.");
        }
        $this->line("----------------------\n");

        // Write report
        $reportPath = base_path('eusebe_import_report.md');
        $this->generateReport($reportPath, $importStats, $warnings, $duplicateCandidates);
        $this->info("Detailed integrity and import report written to: {$reportPath}");

        return 0;
    }

    private function parseSqlFile(string $path): array
    {
        $rawRecords = [];
        $handle = fopen($path, 'r');
        if (!$handle) {
            return [];
        }

        while (($line = fgets($handle)) !== false) {
            $line = trim($line);
            if (empty($line) || !str_starts_with($line, 'INSERT INTO')) {
                continue;
            }

            if (preg_match('/^INSERT INTO `([a-zA-Z0-9_]+)` VALUES/i', $line, $matches)) {
                $tableName = $matches[1];
                if (!isset($this->tableMapping[$tableName])) {
                    continue;
                }

                // Extract everything after VALUES
                $valuesOffset = strpos($line, 'VALUES') + 6;
                $valuesStr = substr($line, $valuesOffset);
                $valuesStr = rtrim($valuesStr, ';');

                $parsedRows = $this->parseInsertValues($valuesStr);
                if (!isset($rawRecords[$tableName])) {
                    $rawRecords[$tableName] = [];
                }
                $rawRecords[$tableName] = array_merge($rawRecords[$tableName], $parsedRows);
            }
        }

        fclose($handle);
        return $rawRecords;
    }

    private function parseInsertValues(string $valuesStr): array
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
                        $currentVal .= $char;
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

    private function normalizeDate(?string $value): ?string
    {
        if ($value === null || $value === '' || $value === '0000-00-00') {
            return 'unknown';
        }

        // Handle YYYY-00-00 and YYYY-MM-00 MySQL style partial dates
        if (preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $value, $matches)) {
            $year = $matches[1];
            $month = $matches[2];
            $day = $matches[3];

            if ($month === '00') {
                return $year;
            }
            if ($day === '00') {
                return $year . '-' . $month;
            }
            return $value;
        }

        return $value;
    }

    private function normalizeImages(?string $value, bool $isMulti = false): mixed
    {
        if ($value === null || trim($value) === '') {
            return null;
        }

        $parts = explode('~', $value);
        $images = [];

        foreach ($parts as $part) {
            $part = trim($part);
            if ($part === '' || $part === 'img/default.png') {
                continue;
            }

            $images[] = [
                'path' => $part,
                'filename' => basename($part),
            ];
        }

        if (count($images) === 0) {
            return null;
        }

        return $isMulti ? $images : $images[0];
    }

    private function checkDuplicates(Database $database, array $tablesByTemplateKey): array
    {
        $duplicates = [];

        // Check 1: Duplicate Authors (Auteurs with same Nom and Prénom)
        $auteursTable = $tablesByTemplateKey['authors'] ?? null;
        if ($auteursTable) {
            $auteurs = Record::where('table_id', $auteursTable->id)->get();
            $grouped = $auteurs->groupBy(function ($rec) {
                return strtolower(trim(($rec->data['Nom'] ?? '') . '|||' . ($rec->data['Prénom'] ?? '')));
            });

            foreach ($grouped as $key => $records) {
                if ($records->count() > 1 && $key !== '|||') {
                    $first = $records->first();
                    $duplicates[] = [
                        'type' => 'auteurs',
                        'identifier' => ($first->data['Prénom'] ?? '') . ' ' . ($first->data['Nom'] ?? ''),
                        'count' => $records->count(),
                        'ids' => $records->pluck('id')->all(),
                    ];
                }
            }
        }

        // Check 2: Duplicate Works (Ouvrages with same Titre)
        $worksTable = $tablesByTemplateKey['works'] ?? null;
        if ($worksTable) {
            $works = Record::where('table_id', $worksTable->id)->get();
            $grouped = $works->groupBy(function ($rec) {
                return strtolower(trim($rec->data['Titre'] ?? ''));
            });

            foreach ($grouped as $key => $records) {
                if ($records->count() > 1 && $key !== '') {
                    $first = $records->first();
                    $duplicates[] = [
                        'type' => 'ouvrages',
                        'identifier' => $first->data['Titre'],
                        'count' => $records->count(),
                        'ids' => $records->pluck('id')->all(),
                    ];
                }
            }
        }

        return $duplicates;
    }

    private function generateReport(string $path, array $stats, array $warnings, array $duplicates): void
    {
        $content = "# Eusèbe Sénécal Database Import & Integrity Report\n\n";
        $content .= "Generated on: " . now()->toDateTimeString() . "\n\n";

        $content .= "## 1. Import Summary\n\n";
        $content .= "| Table (Legacy) | Table (New) | Records Imported |\n";
        $content .= "| :--- | :--- | :--- |\n";
        foreach ($stats as $legacy => $count) {
            $new = $this->tableMapping[$legacy] ?? '';
            $content .= "| `{$legacy}` | `{$new}` | {$count} |\n";
        }
        $content .= "\n";

        $content .= "## 2. Integrity Warnings\n\n";
        if (empty($warnings)) {
            $content .= "✓ No schema or reference validation integrity warnings found!\n\n";
        } else {
            $content .= "| Table | Legacy ID | Type | Message |\n";
            $content .= "| :--- | :--- | :--- | :--- |\n";
            foreach ($warnings as $w) {
                $content .= "| `{$w['table']}` | `{$w['id']}` | `{$w['type']}` | {$w['message']} |\n";
            }
            $content .= "\n";
        }

        $content .= "## 3. Duplicate Candidates\n\n";
        if (empty($duplicates)) {
            $content .= "✓ No duplicate candidates identified.\n\n";
        } else {
            $content .= "| Component | Duplicate Identifier | Matches Found | Record IDs |\n";
            $content .= "| :--- | :--- | :--- | :--- |\n";
            foreach ($duplicates as $d) {
                $ids = implode(', ', array_map(fn($id) => "`{$id}`", $d['ids']));
                $content .= "| `{$d['type']}` | **{$d['identifier']}** | {$d['count']} | {$ids} |\n";
            }
            $content .= "\n";
        }

        file_put_contents($path, $content);
    }
}
