<?php

namespace App\FieldTypes;

class UrlType implements FieldTypeInterface
{
    public function validate(mixed $value, array $options = []): array
    {
        if ($value === null || $value === '') {
            return ['valid' => true, 'error' => null];
        }

        if (! is_string($value)) {
            return ['valid' => false, 'error' => 'Value must be a string'];
        }

        if (! filter_var($value, FILTER_VALIDATE_URL)) {
            return ['valid' => false, 'error' => 'Value must be a valid URL'];
        }

        return ['valid' => true, 'error' => null];
    }

    public function normalize(mixed $value, array $options = []): mixed
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (! is_string($value)) {
            return null;
        }

        return trim($value);
    }

    public function serialize(mixed $value, array $options = []): mixed
    {
        return $this->normalize($value, $options);
    }

    public function getType(): string
    {
        return 'url';
    }
}
