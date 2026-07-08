<?php

namespace App\Http\Controllers;

use App\Services\UploadService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class UploadController extends Controller
{
    public function __construct(
        private UploadService $uploadService
    ) {}

    /**
     * Upload a new file.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|max:20480', // Limit to 20MB
        ]);

        $file = $request->file('file');
        $metadata = $this->uploadService->store($file);

        return response()->json($metadata, 201);
    }

    /**
     * Serve the uploaded file.
     *
     * @param string $hash
     * @return mixed
     */
    public function show(string $hash)
    {
        $path = "uploads/{$hash}";
        
        if (!Storage::exists($path)) {
            return response()->json([
                'error' => 'File not found',
            ], 404);
        }

        $mimeType = Storage::mimeType($path);

        return Storage::response($path, null, [
            'Content-Type' => $mimeType,
            'Cache-Control' => 'public, max-age=31536000',
        ]);
    }

    /**
     * Serve the file thumbnail.
     *
     * @param string $hash
     * @return mixed
     */
    public function showThumbnail(string $hash)
    {
        $path = "uploads/thumbnails/{$hash}";
        
        if (!Storage::exists($path)) {
            return response()->json([
                'error' => 'Thumbnail not found',
            ], 404);
        }

        $mimeType = Storage::mimeType($path);

        return Storage::response($path, null, [
            'Content-Type' => $mimeType,
            'Cache-Control' => 'public, max-age=31536000',
        ]);
    }
}
