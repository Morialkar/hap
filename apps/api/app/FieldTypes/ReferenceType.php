<?php

namespace App\FieldTypes;

class ReferenceType implements FieldTypeInterface
{
    public function validate(mixed $value, array $options = []): array
    {
        if ($value === null || $value === '') {
            return ['valid' => true, 'error' => null];
        }

        $isMulti = ($options['multi'] ?? false) === true;
        $targetTable = $options['target_table'] ?? null;

        if (! $targetTable) {
            return ['valid' => false, 'error' => 'Reference field must specify a target table'];
        }

        if ($isMulti) {
            if (! is_array($value)) {
                return ['valid' => false, 'error' => 'Value must be an array for multi-reference'];
            }

            foreach ($value as $item) {
                if (! $this->isValidUuid($item)) {
                    return ['valid' => false, 'error' => "Invalid reference ID: {$item}"];
                }
            }
        } else {
            if (! $this->isValidUuid($value)) {
                return ['valid' => false, 'error' => "Invalid reference ID: {$value}"];
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
            if (! is_array($value)) {
                return null;
            }

            return array_values(array_filter($value, fn ($v) => $v !== null && $v !== ''));
        }

        return $value;
    }

    public function serialize(mixed $value, array $options = []): mixed
    {
        return $this->normalize($value, $options);
    }

    public function getType(): string
    {
        return 'reference';
    }

    private function isValidUuid(mixed $value): bool
    {
        if (! is_string($value)) {
            return false;
        }

        // Accept both UUIDs and ULIDs
        $uuidPattern = '/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i';
        $ulidPattern = '/^[0-9A-HJKMNP-TV-Z]{26}$/i';

        return preg_match($uuidPattern, $value) === 1 || preg_match($ulidPattern, $value) === 1;
    }
}
