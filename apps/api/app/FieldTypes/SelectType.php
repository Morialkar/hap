<?php

namespace App\FieldTypes;

class SelectType implements FieldTypeInterface
{
    public function validate(mixed $value, array $options = []): array
    {
        if ($value === null || $value === '') {
            return ['valid' => true, 'error' => null];
        }

        $isMulti = ($options['multi'] ?? false) === true;
        $allowedValues = $options['values'] ?? [];

        if (empty($allowedValues)) {
            return ['valid' => false, 'error' => 'Select field must have defined values'];
        }

        if ($isMulti) {
            if (!is_array($value)) {
                return ['valid' => false, 'error' => 'Value must be an array for multi-select'];
            }

            foreach ($value as $item) {
                if (!in_array($item, $allowedValues, true)) {
                    return ['valid' => false, 'error' => "Invalid option: {$item}"];
                }
            }
        } else {
            if (!in_array($value, $allowedValues, true)) {
                return ['valid' => false, 'error' => "Invalid option: {$value}"];
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
        return 'select';
    }
}
