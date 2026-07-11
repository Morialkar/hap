<?php

namespace App\FieldTypes;

use InvalidArgumentException;

class FieldTypeRegistry
{
    private array $types = [];

    public function __construct()
    {
        $this->registerDefaultTypes();
    }

    public function register(string $type, FieldTypeInterface $fieldType): void
    {
        $this->types[$type] = $fieldType;
    }

    public function get(string $type): FieldTypeInterface
    {
        if (! isset($this->types[$type])) {
            throw new InvalidArgumentException("Unknown field type: {$type}");
        }

        return $this->types[$type];
    }

    public function has(string $type): bool
    {
        return isset($this->types[$type]);
    }

    public function all(): array
    {
        return array_keys($this->types);
    }

    private function registerDefaultTypes(): void
    {
        $this->register('text', new ShortTextType);
        $this->register('title', new ShortTextType);
        $this->register('long_text', new LongTextType);
        $this->register('number', new NumberType);
        $this->register('date', new DateType);
        $this->register('boolean', new BooleanType);
        $this->register('select', new SelectType);
        $this->register('reference', new ReferenceType);
        $this->register('image', new ImageType);
        $this->register('file', new FileType);
        $this->register('url', new UrlType);
        $this->register('email', new EmailType);
        $this->register('gps', new GpsType);
        $this->register('compound', new CompoundType);
    }
}
