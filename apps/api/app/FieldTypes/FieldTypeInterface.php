<?php

namespace App\FieldTypes;

interface FieldTypeInterface
{
    /**
     * Validate a value against the field type and options.
     *
     * @param  mixed  $value  The value to validate
     * @param  array  $options  Field-type-specific options
     * @return array{valid: bool, error: string|null}
     */
    public function validate(mixed $value, array $options = []): array;

    /**
     * Normalize a value to its canonical form.
     *
     * @param  mixed  $value  The value to normalize
     * @param  array  $options  Field-type-specific options
     * @return mixed The normalized value
     */
    public function normalize(mixed $value, array $options = []): mixed;

    /**
     * Serialize a value for storage (e.g., JSON encoding).
     *
     * @param  mixed  $value  The value to serialize
     * @param  array  $options  Field-type-specific options
     * @return mixed The serialized value
     */
    public function serialize(mixed $value, array $options = []): mixed;

    /**
     * Get the field type identifier.
     */
    public function getType(): string;
}
