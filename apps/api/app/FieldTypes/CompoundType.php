<?php

namespace App\FieldTypes;

class CompoundType implements FieldTypeInterface
{
    /**
     * Validate a value against the field type and options.
     */
    public function validate(mixed $value, array $options = []): array
    {
        return ['valid' => true, 'error' => null];
    }

    /**
     * Normalize a value to its canonical form.
     */
    public function normalize(mixed $value, array $options = []): mixed
    {
        return $value !== null ? (string) $value : null;
    }

    /**
     * Serialize a value for storage.
     */
    public function serialize(mixed $value, array $options = []): mixed
    {
        return $value !== null ? (string) $value : null;
    }

    /**
     * Get the field type identifier.
     */
    public function getType(): string
    {
        return 'compound';
    }
}
