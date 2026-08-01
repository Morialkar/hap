<?php

namespace App\Http\Controllers;

use App\Http\Resources\ReportResource;
use App\Models\Report;
use App\Models\Table;
use App\Models\View;
use App\Services\ReportQueryService;
use Dompdf\Dompdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    protected ReportQueryService $queryService;

    public function __construct(ReportQueryService $queryService)
    {
        $this->queryService = $queryService;
    }

    public function index(Request $request): JsonResponse
    {
        $databaseId = $request->query('database_id');
        $tableId = $request->query('table_id');
        $query = Report::query();

        if ($tableId) {
            $query->where('table_id', $tableId);
        } elseif ($databaseId) {
            $query->whereHas('table', function ($q) use ($databaseId) {
                $q->where('database_id', $databaseId);
            });
        }

        return response()->json(ReportResource::collection($query->get()));
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'table_id' => 'required|uuid|exists:tables,id',
            'name' => 'required|string|max:255',
            'query' => 'nullable|array',
            'query.where' => 'nullable|array',
            'query.sort' => 'nullable|array',
            'query.select' => 'nullable|array',
            'query.select.*' => 'string',
            'query.group_by' => 'nullable|string',
            'layout' => 'nullable|array',
            'layout.fields' => 'nullable|array',
            'layout.fields.*.name' => 'required_with:layout.fields|string',
            'layout.fields.*.visible' => 'sometimes|boolean',
            'layout.fields.*.order' => 'sometimes|integer',
            'layout.group_order' => 'nullable|array',
            'layout.group_order.*' => 'string',
            // Declared explicitly: validate() only returns keys that carry a rule, so
            // anything omitted here is dropped before the report is persisted.
            'layout.view_id' => 'nullable|uuid|exists:views,id',
            'layout.show_headers_only' => 'nullable|boolean',
            'layout.per_page' => 'nullable|integer|min:1|max:100',
        ]);

        $report = Report::create($validated);

        return response()->json(new ReportResource($report), 201);
    }

    public function show(Report $report): JsonResponse
    {
        return response()->json(new ReportResource($report));
    }

    public function update(Request $request, Report $report): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'query' => 'nullable|array',
            'query.where' => 'nullable|array',
            'query.sort' => 'nullable|array',
            'query.select' => 'nullable|array',
            'query.select.*' => 'string',
            'query.group_by' => 'nullable|string',
            'layout' => 'nullable|array',
            'layout.fields' => 'nullable|array',
            'layout.fields.*.name' => 'required_with:layout.fields|string',
            'layout.fields.*.visible' => 'sometimes|boolean',
            'layout.fields.*.order' => 'sometimes|integer',
            'layout.group_order' => 'nullable|array',
            'layout.group_order.*' => 'string',
            // Declared explicitly: validate() only returns keys that carry a rule, so
            // anything omitted here is dropped before the report is persisted.
            'layout.view_id' => 'nullable|uuid|exists:views,id',
            'layout.show_headers_only' => 'nullable|boolean',
            'layout.per_page' => 'nullable|integer|min:1|max:100',
        ]);

        $report->update($validated);

        return response()->json(new ReportResource($report));
    }

    public function destroy(Report $report): JsonResponse
    {
        $report->delete();

        return response()->json(null, 204);
    }

    public function preview(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'table_id' => 'required|uuid|exists:tables,id',
            'query' => 'nullable|array',
            'layout' => 'nullable|array',
            'per_page' => 'nullable|integer|min:1|max:100',
            'page' => 'nullable|integer|min:1',
        ]);

        $table = Table::findOrFail($validated['table_id']);
        $ast = $validated['query'] ?? [];
        $layout = $validated['layout'] ?? null;
        $perPage = $validated['per_page'] ?? null;
        $page = $validated['page'] ?? null;

        $result = $this->queryService->execute($table, $ast, $perPage, $page, $layout);

        return response()->json($result);
    }

    public function execute(Request $request, Report $report): JsonResponse
    {
        $validated = $request->validate([
            'per_page' => 'nullable|integer|min:1|max:100',
            'page' => 'nullable|integer|min:1',
        ]);

        $table = $report->table;
        $ast = $report->query ?? [];
        $layout = $report->layout;
        $perPage = $validated['per_page'] ?? null;
        $page = $validated['page'] ?? null;

        $result = $this->queryService->execute($table, $ast, $perPage, $page, $layout);

        return response()->json($result);
    }

    public function exportPdf(Report $report)
    {
        $table = $report->table;
        $ast = $report->query ?? [];
        $layout = $report->layout;

        $result = $this->queryService->execute($table, $ast, null, null, $layout);
        $filename = 'rapport_'.strtolower(str_replace(' ', '_', $report->name)).'.pdf';

        return $this->generatePdfResponse($report->name, $result['columns'], $result['groups'], $ast['group_by'] ?? null, $filename, $layout);
    }

    public function exportCsv(Report $report)
    {
        $table = $report->table;
        $ast = $report->query ?? [];
        $layout = $report->layout;

        $result = $this->queryService->execute($table, $ast, null, null, $layout);
        $filename = 'rapport_'.strtolower(str_replace(' ', '_', $report->name)).'.csv';

        return $this->generateCsvResponse($result['columns'], $result['groups'], $ast['group_by'] ?? null, $filename, $layout);
    }

    public function previewPdf(Request $request)
    {
        $validated = $request->validate([
            'table_id' => 'required|uuid|exists:tables,id',
            'name' => 'sometimes|required|string|max:255',
            'query' => 'nullable|array',
            'layout' => 'nullable|array',
        ]);

        $table = Table::findOrFail($validated['table_id']);
        $reportName = $validated['name'] ?? 'Rapport temporaire';
        $ast = $validated['query'] ?? [];
        $layout = $validated['layout'] ?? null;

        $result = $this->queryService->execute($table, $ast, null, null, $layout);
        $filename = 'rapport_apercu.pdf';

        return $this->generatePdfResponse($reportName, $result['columns'], $result['groups'], $ast['group_by'] ?? null, $filename, $layout);
    }

    public function previewCsv(Request $request)
    {
        $validated = $request->validate([
            'table_id' => 'required|uuid|exists:tables,id',
            'query' => 'nullable|array',
            'layout' => 'nullable|array',
        ]);

        $table = Table::findOrFail($validated['table_id']);
        $ast = $validated['query'] ?? [];
        $layout = $validated['layout'] ?? null;

        $result = $this->queryService->execute($table, $ast, null, null, $layout);
        $filename = 'rapport_apercu.csv';

        return $this->generateCsvResponse($result['columns'], $result['groups'], $ast['group_by'] ?? null, $filename, $layout);
    }

    private function generatePdfResponse(string $reportName, array $columns, array $groups, ?string $groupBy, string $filename, ?array $layout = null)
    {
        $view = null;
        if ($layout && isset($layout['view_id'])) {
            $view = View::with('table.fields')->find($layout['view_id']);
        }

        $html = view('reports.pdf', [
            'reportName' => $reportName,
            'columns' => $columns,
            'groups' => $groups,
            'groupBy' => $groupBy,
            'layout' => $layout,
            'view' => $view,
        ])->render();

        $dompdf = new Dompdf([
            'isHtml5ParserEnabled' => true,
            'isPhpEnabled' => false,
            'defaultPaperSize' => 'a4',
            'defaultPaperOrientation' => 'portrait',
        ]);
        $dompdf->loadHtml($html);
        $dompdf->render();

        return response($dompdf->output(), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
        ]);
    }

    private function generateCsvResponse(array $columns, array $groups, ?string $groupBy, string $filename, ?array $layout = null)
    {
        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
        ];

        $callback = function () use ($columns, $groups, $groupBy, $layout) {
            $file = fopen('php://output', 'w');
            fprintf($file, chr(0xEF).chr(0xBB).chr(0xBF)); // BOM UTF-8

            $csvHeaders = [];
            $showHeadersOnly = ($layout['show_headers_only'] ?? false) === true;
            // The group field is commonly also a selected column; emit it once.
            $groupIsSelectedColumn = $groupBy !== null && in_array($groupBy, $columns, true);
            if ($showHeadersOnly) {
                $csvHeaders[] = $groupBy ?? 'Groupe';
                $csvHeaders[] = 'Nombre de fiches';
            } else {
                if ($groupBy && ! $groupIsSelectedColumn) {
                    $csvHeaders[] = $groupBy;
                }
                foreach ($columns as $col) {
                    $csvHeaders[] = $col;
                }
            }
            fputcsv($file, $csvHeaders);

            foreach ($groups as $group) {
                $groupKey = $group['key'];
                if ($showHeadersOnly) {
                    $row = [$groupKey, count($group['records'])];
                    fputcsv($file, $row);
                } else {
                    foreach ($group['records'] as $rec) {
                        $row = [];
                        if ($groupBy && ! $groupIsSelectedColumn) {
                            $row[] = $groupKey;
                        }
                        foreach ($columns as $col) {
                            $val = $rec[$col] ?? null;
                            $row[] = is_array($val) ? implode(', ', $val) : $val;
                        }
                        fputcsv($file, $row);
                    }
                }
            }
            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }
}
