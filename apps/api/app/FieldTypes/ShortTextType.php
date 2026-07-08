<?php

namespace App\FieldTypes;

class ShortTextType implements FieldTypeInterface
{
    public function validate(mixed $value, array $options = []): array
    {
        if ($value === null || $value === '') {
            return ['valid' => true, 'error' => null];
        }

        if (!is_string($value)) {
            return ['valid' => false, 'error' => 'Value must be a string'];
        }

        $maxLength = $options['max_length'] ?? 255;

        if (mb_strlen($value) > $maxLength) {
            return ['valid' => false, 'error' => "Value must not exceed {$maxLength} characters"];
        }

        return ['valid' => true, 'error' => null];
    }

    public function normalize(mixed $value, array $options = []): mixed
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (!is_string($value)) {
            return (string) $value;
        }

        return trim($value);
    }

    public function serialize(mixed $value, array $options = []): mixed
    {
        return $this->normalize($value, $options);
    }

    public function getType(): string
    {
        return 'text';
    }
}
