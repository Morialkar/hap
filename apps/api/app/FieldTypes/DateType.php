<?php

namespace App\FieldTypes;

class DateType implements FieldTypeInterface
{
    public function validate(mixed $value, array $options = []): array
    {
        if ($value === null || $value === '') {
            return ['valid' => true, 'error' => null];
        }

        if (!is_string($value)) {
            return ['valid' => false, 'error' => 'Value must be a string'];
        }

        // Allow "unknown" as a special value
        if ($value === 'unknown') {
            return ['valid' => true, 'error' => null];
        }

        // Validate partial date formats: YYYY, YYYY-MM, YYYY-MM-DD
        if (!preg_match('/^\d{4}$/', $value) && 
            !preg_match('/^\d{4}-\d{2}$/', $value) && 
            !preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
            return ['valid' => false, 'error' => 'Date must be in YYYY, YYYY-MM, or YYYY-MM-DD format, or "unknown"'];
        }

        // Validate month and day if present
        if (preg_match('/^\d{4}-\d{2}$/', $value)) {
            $month = (int) substr($value, 5, 2);
            if ($month < 1 || $month > 12) {
                return ['valid' => false, 'error' => 'Invalid month'];
            }
        }

        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
            $month = (int) substr($value, 5, 2);
            $day = (int) substr($value, 8, 2);
            
            if ($month < 1 || $month > 12) {
                return ['valid' => false, 'error' => 'Invalid month'];
            }
            
            if ($day < 1 || $day > 31) {
                return ['valid' => false, 'error' => 'Invalid day'];
            }
        }

        return ['valid' => true, 'error' => null];
    }

    public function normalize(mixed $value, array $options = []): mixed
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (!is_string($value)) {
            return null;
        }

        $value = trim($value);

        if ($value === 'unknown') {
            return 'unknown';
        }

        // Normalize to ensure consistent format
        if (preg_match('/^\d{4}$/', $value)) {
            return $value; // YYYY
        }

        if (preg_match('/^\d{4}-\d{2}$/', $value)) {
            return $value; // YYYY-MM
        }

        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
            return $value; // YYYY-MM-DD
        }

        return null;
    }

    public function serialize(mixed $value, array $options = []): mixed
    {
        return $this->normalize($value, $options);
    }

    public function getType(): string
    {
        return 'date';
    }
}
