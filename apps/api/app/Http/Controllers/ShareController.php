<?php

namespace App\Http\Controllers;

use App\Models\Database;
use App\Models\Record;
use App\Models\Report;
use App\Models\Share;
use App\Models\View;
use App\Services\RecordQueryService;
use App\Services\ReportQueryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ShareController extends Controller
{
    public function __construct(
        private RecordQueryService $recordQueryService,
        private ReportQueryService $reportQueryService
    ) {}

    /**
     * List all shares for a database.
     */
    public function index(Database $database): JsonResponse
    {
        $shares = Share::where('database_id', $database->id)
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($share) {
                $targetName = 'Inconnu';
                if ($share->target_type === 'record') {
                    $rec = Record::find($share->target_id);
                    if ($rec) {
                        $titleField = $rec->table->fields->first(fn ($f) => ($f->options['is_title'] ?? false) || $f->type === 'title');
                        $targetName = $titleField ? ($rec->data[$titleField->name] ?? 'Fiche') : 'Fiche';
                    }
                } elseif ($share->target_type === 'view') {
                    $view = View::find($share->target_id);
                    $targetName = $view ? $view->name : 'Disposition';
                } elseif ($share->target_type === 'report') {
                    $report = Report::find($share->target_id);
                    $targetName = $report ? $report->name : 'Rapport';
                }

                return [
                    'id' => $share->id,
                    'name' => $share->name,
                    'token' => $share->token,
                    'target_type' => $share->target_type,
                    'target_id' => $share->target_id,
                    'target_name' => $targetName,
                    'expires_at' => $share->expires_at ? $share->expires_at->toIso8601String() : null,
                    'created_at' => $share->created_at->toIso8601String(),
                    'is_expired' => $share->isExpired(),
                ];
            });

        return response()->json($shares);
    }

    /**
     * Create a new share link.
     */
    public function store(Request $request, Database $database): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'target_type' => 'required|string|in:record,view,report',
            'target_id' => 'required|string',
            'expires_at' => 'nullable|date|after:now',
        ]);

        // Validate target exists and belongs to database context
        if ($validated['target_type'] === 'record') {
            $record = Record::findOrFail($validated['target_id']);
            if ($record->table->database_id !== $database->id) {
                abort(403, 'Record does not belong to this database.');
            }
        } elseif ($validated['target_type'] === 'view') {
            $view = View::findOrFail($validated['target_id']);
            if ($view->table->database_id !== $database->id) {
                abort(403, 'View does not belong to this database.');
            }
        } elseif ($validated['target_type'] === 'report') {
            $report = Report::findOrFail($validated['target_id']);
            if ($report->table->database_id !== $database->id) {
                abort(403, 'Report does not belong to this database.');
            }
        }

        $share = Share::create([
            'database_id' => $database->id,
            'token' => Str::random(40),
            'name' => $validated['name'],
            'target_type' => $validated['target_type'],
            'target_id' => $validated['target_id'],
            'expires_at' => $validated['expires_at'] ?? null,
        ]);

        return response()->json($share, 201);
    }

    /**
     * Revoke (delete) a share link.
     */
    public function destroy(Share $share): JsonResponse
    {
        $share->delete();

        return response()->json(null, 204);
    }

    /**
     * Public show endpoint.
     */
    public function show(string $token): JsonResponse
    {
        $share = Share::where('token', $token)->firstOrFail();
        if ($share->isExpired()) {
            return response()->json(['error' => 'Share link expired'], 410);
        }

        $database = $share->database;

        if ($share->target_type === 'record') {
            $record = Record::findOrFail($share->target_id);
            if ($record->trashed()) {
                abort(404, 'Shared record has been deleted.');
            }
            $table = $record->table;
            $resolvedData = $this->resolveRecordReferences($record);

            return response()->json([
                'target_type' => 'record',
                'name' => $share->name,
                'database_name' => $database->name,
                'table_name' => $table->name,
                'record' => [
                    'id' => $record->id,
                    'data' => $resolvedData,
                ],
                'fields' => $table->fields,
            ]);
        }

        if ($share->target_type === 'view') {
            $view = View::findOrFail($share->target_id);
            $table = $view->table;
            $params = [
                'per_page' => 100,
            ];
            $result = $this->recordQueryService->queryRecords($table, $params);
            $resolvedRecords = collect($result['data'])->map(function ($record) {
                return [
                    'id' => $record->id,
                    'data' => $this->resolveRecordReferences($record),
                    'created_at' => $record->created_at,
                    'updated_at' => $record->updated_at,
                ];
            });

            return response()->json([
                'target_type' => 'view',
                'name' => $share->name,
                'database_name' => $database->name,
                'table_name' => $table->name,
                'view' => $view,
                'records' => $resolvedRecords,
                'fields' => $table->fields,
            ]);
        }

        if ($share->target_type === 'report') {
            $report = Report::findOrFail($share->target_id);
            $table = $report->table;
            $ast = $report->query ?? [];
            $layout = $report->layout;

            // If headers only, disable pagination parameters
            $perPage = null;
            $page = null;
            if (! $layout || ! ($layout['show_headers_only'] ?? false)) {
                $perPage = 100;
                $page = 1;
            }

            $result = $this->reportQueryService->execute($table, $ast, $perPage, $page, $layout);

            return response()->json([
                'target_type' => 'report',
                'name' => $share->name,
                'database_name' => $database->name,
                'table_name' => $table->name,
                'report' => $report,
                'result' => $result,
                'fields' => $table->fields,
            ]);
        }

        abort(400, 'Invalid share target type.');
    }

    /**
     * Serve uploads with scope protection and EXIF stripping.
     */
    public function serveUpload(string $token, string $hash)
    {
        $share = Share::where('token', $token)->firstOrFail();
        if ($share->isExpired()) {
            abort(410, 'Share expired');
        }

        if (! $this->validateUploadScope($share, $hash)) {
            abort(403, 'Unauthorized file scope');
        }

        $path = "uploads/{$hash}";
        if (! Storage::exists($path)) {
            abort(404, 'File not found');
        }

        $mimeType = Storage::mimeType($path);

        if ($mimeType && str_starts_with($mimeType, 'image/')) {
            $realPath = Storage::path($path);
            $strippedPath = $this->stripExif($realPath, $mimeType);

            if ($strippedPath !== $realPath) {
                return response()->file($strippedPath, [
                    'Content-Type' => $mimeType,
                    'Cache-Control' => 'no-store, no-cache, must-revalidate',
                ])->deleteFileAfterSend(true);
            }
        }

        return Storage::response($path, null, [
            'Content-Type' => $mimeType,
        ]);
    }

    /**
     * Serve thumbnails securely.
     */
    public function serveUploadThumbnail(string $token, string $hash)
    {
        $share = Share::where('token', $token)->firstOrFail();
        if ($share->isExpired()) {
            abort(410, 'Share expired');
        }

        if (! $this->validateUploadScope($share, $hash)) {
            abort(403, 'Unauthorized file scope');
        }

        $path = "uploads/thumbnails/{$hash}";
        if (! Storage::exists($path)) {
            abort(404, 'Thumbnail not found');
        }

        $mimeType = Storage::mimeType($path);

        return Storage::response($path, null, [
            'Content-Type' => $mimeType,
            'Cache-Control' => 'public, max-age=31536000',
        ]);
    }

    /**
     * Validate if the upload hash is within the shared target dataset scope.
     */
    private function validateUploadScope(Share $share, string $hash): bool
    {
        if ($share->target_type === 'record') {
            $record = Record::find($share->target_id);
            if (! $record || $record->trashed()) {
                return false;
            }

            return str_contains(json_encode($record->data), $hash);
        }

        if ($share->target_type === 'view') {
            $view = View::find($share->target_id);
            if (! $view) {
                return false;
            }

            return Record::where('table_id', $view->table_id)
                ->whereRaw('data::text LIKE ?', ["%{$hash}%"])
                ->exists();
        }

        if ($share->target_type === 'report') {
            $report = Report::find($share->target_id);
            if (! $report) {
                return false;
            }

            return Record::where('table_id', $report->table_id)
                ->whereRaw('data::text LIKE ?', ["%{$hash}%"])
                ->exists();
        }

        return false;
    }

    /**
     * Strip EXIF metadata on the fly using GD.
     */
    private function stripExif(string $sourcePath, string $mimeType): string
    {
        if (! in_array($mimeType, ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'], true)) {
            return $sourcePath;
        }

        try {
            $sourceImage = match ($mimeType) {
                'image/jpeg', 'image/jpg' => @imagecreatefromjpeg($sourcePath),
                'image/png' => @imagecreatefrompng($sourcePath),
                'image/webp' => @imagecreatefromwebp($sourcePath),
                default => null,
            };

            if (! $sourceImage) {
                return $sourcePath;
            }

            $tempFile = tempnam(sys_get_temp_dir(), 'exifstrip');
            $success = match ($mimeType) {
                'image/jpeg', 'image/jpg' => imagejpeg($sourceImage, $tempFile, 95),
                'image/png' => imagepng($sourceImage, $tempFile, 9),
                'image/webp' => imagewebp($sourceImage, $tempFile, 95),
                default => false,
            };

            imagedestroy($sourceImage);

            return $success ? $tempFile : $sourcePath;
        } catch (\Throwable $e) {
            return $sourcePath;
        }
    }

    /**
     * Resolve reference IDs to display names for public share view.
     */
    private function resolveRecordReferences(Record $record): array
    {
        $data = $record->data;
        $table = $record->table;

        foreach ($table->fields as $field) {
            if ($field->type === 'reference' && ! empty($data[$field->name])) {
                $refId = $data[$field->name];
                if (is_array($refId)) {
                    $labels = [];
                    foreach ($refId as $id) {
                        $targetRec = Record::find($id);
                        if ($targetRec) {
                            $titleField = $targetRec->table->fields->first(fn ($f) => ($f->options['is_title'] ?? false) || $f->type === 'title');
                            $labels[] = $titleField ? ($targetRec->data[$titleField->name] ?? $id) : $id;
                        } else {
                            $labels[] = $id;
                        }
                    }
                    $data[$field->name] = $labels;
                } else {
                    $targetRec = Record::find($refId);
                    if ($targetRec) {
                        $titleField = $targetRec->table->fields->first(fn ($f) => ($f->options['is_title'] ?? false) || $f->type === 'title');
                        $data[$field->name] = $titleField ? ($targetRec->data[$titleField->name] ?? $refId) : $refId;
                    }
                }
            }
        }

        return $data;
    }
}
