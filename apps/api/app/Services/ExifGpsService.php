<?php

namespace App\Services;

class ExifGpsService
{
    public function extract(string $path, string $mimeType): ?array
    {
        if (! in_array($mimeType, ['image/jpeg', 'image/jpg'], true) || ! function_exists('exif_read_data')) {
            return null;
        }
        $gps = (@exif_read_data($path, 'GPS', true))['GPS'] ?? null;
        if (! is_array($gps) || ! isset($gps['GPSLatitude'], $gps['GPSLongitude'], $gps['GPSLatitudeRef'], $gps['GPSLongitudeRef'])) {
            return null;
        }
        $lat = $this->decimal($gps['GPSLatitude']);
        $lng = $this->decimal($gps['GPSLongitude']);
        if ($lat === null || $lng === null) {
            return null;
        }

        return ['lat' => round($gps['GPSLatitudeRef'] === 'S' ? -$lat : $lat, 6), 'lng' => round($gps['GPSLongitudeRef'] === 'W' ? -$lng : $lng, 6)];
    }

    private function decimal(array $values): ?float
    {
        if (count($values) < 3) {
            return null;
        }
        $parts = array_map(fn ($value) => $this->fraction($value), array_slice($values, 0, 3));
        if (in_array(null, $parts, true)) {
            return null;
        }

        return $parts[0] + ($parts[1] / 60) + ($parts[2] / 3600);
    }

    private function fraction(mixed $value): ?float
    {
        if (is_numeric($value)) {
            return (float) $value;
        }
        if (! is_string($value) || ! str_contains($value, '/')) {
            return null;
        }
        [$numerator, $denominator] = explode('/', $value, 2);

        return is_numeric($numerator) && is_numeric($denominator) && (float) $denominator !== 0.0 ? (float) $numerator / (float) $denominator : null;
    }
}
