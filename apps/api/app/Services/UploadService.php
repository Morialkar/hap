<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

class UploadService
{
    public function __construct(private ExifGpsService $exifGpsService) {}

    /**
     * Store an uploaded file.
     */
    public function store(UploadedFile $file): array
    {
        // 1. Calculate SHA-256 hash of file content
        $hash = hash_file('sha256', $file->getRealPath());

        // Determine file details
        $originalFilename = $file->getClientOriginalName();
        $mimeType = $file->getMimeType() ?: $file->getClientMimeType();
        $size = $file->getSize();

        // 2. Put file to storage (content-addressed, uploads/{hash})
        $path = "uploads/{$hash}";

        if (! Storage::exists($path)) {
            // Using read stream for memory efficiency
            $stream = fopen($file->getRealPath(), 'r');
            Storage::put($path, $stream);
            fclose($stream);
        }

        $metadata = [
            'path' => $path,
            'filename' => $originalFilename,
            'size' => $size,
            'mime_type' => $mimeType,
            'hash' => $hash,
            'url' => url("/api/v1/uploads/{$hash}"),
        ];

        // 3. Generate thumbnail if image
        if (str_starts_with($mimeType, 'image/')) {
            if ($gps = $this->exifGpsService->extract($file->getRealPath(), $mimeType)) {
                $metadata['gps'] = $gps;
            }
            $thumbnailPath = "uploads/thumbnails/{$hash}";
            if (! Storage::exists($thumbnailPath)) {
                $this->generateThumbnail($file->getRealPath(), $thumbnailPath, $mimeType);
            }

            $metadata['thumbnail_path'] = $thumbnailPath;
            $metadata['thumbnail_url'] = url("/api/v1/uploads/{$hash}/thumbnail");
        }

        return $metadata;
    }

    /**
     * Generate image thumbnail using GD.
     */
    private function generateThumbnail(string $sourcePath, string $targetPath, string $mimeType, int $maxSize = 200): bool
    {
        // Get original image dimensions
        [$width, $height] = getimagesize($sourcePath);
        if (! $width || ! $height) {
            return false;
        }

        // Calculate thumbnail dimensions
        $ratio = $width / $height;
        if ($width > $height) {
            $newWidth = $maxSize;
            $newHeight = (int) ($maxSize / $ratio);
        } else {
            $newHeight = $maxSize;
            $newWidth = (int) ($maxSize * $ratio);
        }

        // Create image from source
        $sourceImage = match ($mimeType) {
            'image/jpeg', 'image/jpg' => imagecreatefromjpeg($sourcePath),
            'image/png' => imagecreatefrompng($sourcePath),
            'image/gif' => imagecreatefromgif($sourcePath),
            'image/webp' => imagecreatefromwebp($sourcePath),
            default => null,
        };

        if (! $sourceImage) {
            return false;
        }

        // Create true color image for thumbnail
        $thumbImage = imagecreatetruecolor($newWidth, $newHeight);

        // Preserve transparency for PNG and WebP
        if ($mimeType === 'image/png' || $mimeType === 'image/webp') {
            imagealphablending($thumbImage, false);
            imagesavealpha($thumbImage, true);
        }

        // Resize
        imagecopyresampled($thumbImage, $sourceImage, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);

        // Save thumbnail to a temp file first
        $tempFile = tempnam(sys_get_temp_dir(), 'thumb');
        $success = match ($mimeType) {
            'image/jpeg', 'image/jpg' => imagejpeg($thumbImage, $tempFile, 90),
            'image/png' => imagepng($thumbImage, $tempFile, 9),
            'image/gif' => imagegif($thumbImage, $tempFile),
            'image/webp' => imagewebp($thumbImage, $tempFile, 90),
            default => false,
        };

        // Free memory
        imagedestroy($sourceImage);
        imagedestroy($thumbImage);

        if ($success) {
            // Put file to storage
            $stream = fopen($tempFile, 'r');
            Storage::put($targetPath, $stream);
            fclose($stream);
            unlink($tempFile);

            return true;
        }

        return false;
    }
}
