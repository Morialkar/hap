<?php

namespace App\Http\Controllers;

use App\Http\Requests\ExportTemplateRequest;
use App\Http\Requests\InstallTemplateRequest;
use App\Http\Resources\DatabaseResource;
use App\Http\Resources\TemplateResource;
use App\Models\Database;
use App\Models\Template;
use App\Models\Workspace;
use App\Services\TemplateExportService;
use App\Services\TemplateInstallService;
use Illuminate\Http\JsonResponse;

class TemplateController extends Controller
{
    public function __construct(
        private TemplateExportService $exportService,
        private TemplateInstallService $installService,
    ) {}

    public function export(ExportTemplateRequest $request, Database $database): JsonResponse
    {
        $payload = $this->exportService->export($database);
        $template = Template::create([
            'database_id' => $database->id,
            'source_database_id' => $database->id,
            'name' => $request->validated('name') ?? $database->name,
            'description' => $request->validated('description'),
            'format_version' => 1,
            'template_version' => $request->validated('template_version') ?? '1.0.0',
            'schema' => $payload,
            'payload' => $payload,
            'includes_demo_records' => ! empty($payload['demo_records']),
        ]);

        return response()->json(new TemplateResource($template), 201);
    }

    public function install(InstallTemplateRequest $request, Workspace $workspace): JsonResponse
    {
        $result = $this->installService->install($workspace, $request->validated());

        return response()->json([
            'database' => new DatabaseResource($result['database']),
            'template' => new TemplateResource($result['template']),
        ], 201);
    }
}
