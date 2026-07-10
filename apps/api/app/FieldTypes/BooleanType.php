<?php

namespace App\FieldTypes;

class BooleanType implements FieldTypeInterface
{
    public function validate(mixed $value, array $options = []): array
    {
        if ($value === null || $value === '') {
            return ['valid' => true, 'error' => null];
        }

        if (! is_bool($value) && ! in_array($value, [0, 1, '0', '1', true, false], true)) {
            return ['valid' => false, 'error' => 'Value must be a boolean'];
        }

        return ['valid' => true, 'error' => null];
    }

    public function normalize(mixed $value, array $options = []): mixed
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_bool($value)) {
            return $value;
        }

        if (in_array($value, [1, '1', true], true)) {
            return true;
        }

        if (in_array($value, [0, '0', false], true)) {
            return false;
        }

        return null;
    }

    public function serialize(mixed $value, array $options = []): mixed
    {
        return $this->normalize($value, $options);
    }

    public function getType(): string
    {
        return 'boolean';
    }
}
