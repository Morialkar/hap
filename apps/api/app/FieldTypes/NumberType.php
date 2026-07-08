<?php

namespace App\FieldTypes;

class NumberType implements FieldTypeInterface
{
    public function validate(mixed $value, array $options = []): array
    {
        if ($value === null || $value === '') {
            return ['valid' => true, 'error' => null];
        }

        $isDecimal = ($options['decimal'] ?? false) === true;
        $min = $options['min'] ?? null;
        $max = $options['max'] ?? null;

        if (!is_numeric($value)) {
            return ['valid' => false, 'error' => 'Value must be a number'];
        }

        $numericValue = $isDecimal ? (float) $value : (int) $value;

        if ($min !== null && $numericValue < $min) {
            return ['valid' => false, 'error' => "Value must be at least {$min}"];
        }

        if ($max !== null && $numericValue > $max) {
            return ['valid' => false, 'error' => "Value must be at most {$max}"];
        }

        if (!$isDecimal && !is_int($value * 1)) {
            return ['valid' => false, 'error' => 'Value must be an integer'];
        }

        return ['valid' => true, 'error' => null];
    }

    public function normalize(mixed $value, array $options = []): mixed
    {
        if ($value === null || $value === '') {
            return null;
        }

        $isDecimal = ($options['decimal'] ?? false) === true;

        if (!is_numeric($value)) {
            return null;
        }

        return $isDecimal ? (float) $value : (int) $value;
    }

    public function serialize(mixed $value, array $options = []): mixed
    {
        return $this->normalize($value, $options);
    }

    public function getType(): string
    {
        return 'number';
    }
}
