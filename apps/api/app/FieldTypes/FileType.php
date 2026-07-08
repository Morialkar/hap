<?php

namespace App\FieldTypes;

class FileType implements FieldTypeInterface
{
    public function validate(mixed $value, array $options = []): array
    {
        if ($value === null || $value === '') {
            return ['valid' => true, 'error' => null];
        }

        $isMulti = ($options['multi'] ?? false) === true;

        if ($isMulti) {
            if (!is_array($value)) {
                return ['valid' => false, 'error' => 'Value must be an array for multi-file'];
            }

            foreach ($value as $item) {
                if (!$this->isValidFileMetadata($item)) {
                    return ['valid' => false, 'error' => 'Invalid file metadata structure'];
                }
            }
        } else {
            if (!$this->isValidFileMetadata($value)) {
                return ['valid' => false, 'error' => 'Invalid file metadata structure'];
            }
        }

        return ['valid' => true, 'error' => null];
    }

    public function normalize(mixed $value, array $options = []): mixed
    {
        if ($value === null || $value === '') {
            return null;
        }

        $isMulti = ($options['multi'] ?? false) === true;

        if ($isMulti) {
            if (!is_array($value)) {
                return null;
            }

            return array_values(array_filter($value, fn($v) => $v !== null && $v !== ''));
        }

        return $value;
    }

    public function serialize(mixed $value, array $options = []): mixed
    {
        return $this->normalize($value, $options);
    }

    public function getType(): string
    {
        return 'file';
    }

    private function isValidFileMetadata(mixed $value): bool
    {
        if (!is_array($value)) {
            return false;
        }

        // Expected structure: { path: string, filename: string, size: int, mime_type: string }
        return isset($value['path']) && is_string($value['path']) &&
               isset($value['filename']) && is_string($value['filename']);
    }
}
