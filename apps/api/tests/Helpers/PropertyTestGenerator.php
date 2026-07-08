<?php

namespace Tests\Helpers;

use App\FieldTypes\FieldTypeRegistry;

class PropertyTestGenerator
{
    private FieldTypeRegistry $fieldTypeRegistry;

    public function __construct()
    {
        $this->fieldTypeRegistry = new FieldTypeRegistry();
    }

    /**
     * Generate arbitrary valid field definition.
     */
    public function generateFieldDefinition(): array
    {
        $types = ['text', 'long_text', 'number', 'date', 'boolean', 'select', 'reference', 'image', 'file', 'url', 'email'];
        $type = $types[array_rand($types)];

        $field = [
            'name' => $this->generateFieldName(),
            'type' => $type,
            'position' => rand(0, 100),
            'options' => $this->generateOptionsForType($type),
            'validation' => $this->generateValidationForType($type),
        ];

        return $field;
    }

    /**
     * Generate arbitrary valid field value for a given field definition.
     */
    public function generateFieldValue(array $field): mixed
    {
        $type = $field['type'];
        $options = $field['options'] ?? [];

        return match ($type) {
            'text' => $this->generateTextValue($options),
            'long_text' => $this->generateLongTextValue(),
            'number' => $this->generateNumberValue($options),
            'date' => $this->generateDateValue(),
            'boolean' => $this->generateBooleanValue(),
            'select' => $this->generateSelectValue($options),
            'reference' => $this->generateReferenceValue($options),
            'image', 'file' => $this->generateFileMetadata(),
            'url' => $this->generateUrlValue(),
            'email' => $this->generateEmailValue(),
            default => null,
        };
    }

    /**
     * Generate arbitrary valid record data for a table schema.
     */
    public function generateRecordData(array $fields): array
    {
        $data = [];
        foreach ($fields as $field) {
            $data[$field['name']] = $this->generateFieldValue($field);
        }
        return $data;
    }

    /**
     * Generate nasty strings corpus for testing edge cases.
     */
    public function generateNastyString(): string
    {
        $nastyStrings = [
            '', // Empty
            ' ', // Space
            '  ', // Multiple spaces
            "\t", // Tab
            "\n", // Newline
            "\r\n", // Windows newline
            "éÈœ", // Accents
            "🎉", // Emoji
            "<script>alert('xss')</script>", // XSS attempt
            "'; DROP TABLE users; --", // SQL injection attempt
            str_repeat('a', 10000), // Very long string
            'null', // String "null"
            '0', // String zero
            'false', // String false
            'true', // String true
            '[]', // Empty array string
            '{}', // Empty object string
            "a\r\nb", // CRLF
            "a\nb", // LF
            "a\rb", // CR
            "a\tb", // Tab
            "a/b", // Forward slash
            "a\\nb", // Escaped newline
            "a\\tb", // Escaped tab
            "a\\rb", // Escaped carriage return
            "a\\x01b", // Hex control character
            "a\\x1Fb", // Hex control character
            "a\\x7Fb", // Hex control character
            "a\\x80b", // Hex control character
            "a\\xFFb", // Hex control character
            "a\\u0080b", // Unicode control character
            "a\\uFFFFb", // Unicode control character
            "a\\uD800b", // Unicode surrogate
            "a\\uDC00b", // Unicode surrogate
            "a\\uDFFFb", // Unicode surrogate
            "a\\uDBFFb", // Unicode surrogate
            "a\\uE000b", // Unicode private use
            "a\\uF8FFb", // Unicode private use
            "a\\uF0000b", // Unicode supplementary private use
            "a\\uFFFFDb", // Unicode supplementary private use
            "a\\uFFFEb", // Unicode non-character
            "a\\uFFFFb", // Unicode non-character
            "a\\uFEFFb", // Unicode BOM
            "a\\uFFFD", // Unicode replacement character
            "a\u{FFFD}b", // Unicode replacement character (PHP 7.0+)
            "a\u{200B}b", // Zero-width space
            "a\u{200C}b", // Zero-width non-joiner
            "a\u{200D}b", // Zero-width joiner
            "a\u{FEFF}b", // Zero-width no-break space
            "a\u{2060}b", // Word joiner
            "a\u{034F}b", // Combining grapheme joiner
            "a\u{180E}b", // Mongolian vowel separator
            "a\u{1806}b", // Mongolian todo soft hyphen
            "a\u{00AD}b", // Soft hyphen
        ];

        return $nastyStrings[array_rand($nastyStrings)];
    }

    private function generateFieldName(): string
    {
        $prefixes = ['field_', 'col_', 'attr_', 'prop_', ''];
        $names = ['title', 'name', 'description', 'content', 'value', 'data', 'text', 'number', 'date', 'status', 'type', 'category', 'tag', 'label'];
        
        return $prefixes[array_rand($prefixes)] . $names[array_rand($names)] . '_' . rand(1, 999);
    }

    private function generateOptionsForType(string $type): array
    {
        return match ($type) {
            'text' => ['max_length' => rand(10, 500)],
            'number' => [
                'decimal' => (bool) rand(0, 1),
                'min' => rand(-1000, 0),
                'max' => rand(0, 1000),
            ],
            'select' => [
                'multi' => (bool) rand(0, 1),
                'values' => ['option1', 'option2', 'option3'],
            ],
            'reference' => [
                'multi' => (bool) rand(0, 1),
                'target_table' => (string) \Illuminate\Support\Str::uuid(),
            ],
            default => [],
        };
    }

    private function generateValidationForType(string $type): array
    {
        return match ($type) {
            'text', 'long_text' => ['required' => (bool) rand(0, 1)],
            'number' => ['required' => (bool) rand(0, 1)],
            'date' => ['required' => (bool) rand(0, 1)],
            'email' => ['required' => (bool) rand(0, 1)],
            'url' => ['required' => (bool) rand(0, 1)],
            default => [],
        };
    }

    private function generateTextValue(array $options): string
    {
        $maxLength = $options['max_length'] ?? 255;
        $length = rand(1, $maxLength);
        
        // Include accents sometimes
        if (rand(0, 10) === 0) {
            return substr(str_repeat('éÈœ', ceil($length / 3)), 0, $length);
        }
        
        return substr(str_repeat('a', $length), 0, $length);
    }

    private function generateLongTextValue(): string
    {
        return str_repeat('Lorem ipsum dolor sit amet. ', rand(1, 50));
    }

    private function generateNumberValue(array $options): int|float
    {
        $isDecimal = $options['decimal'] ?? false;
        $min = $options['min'] ?? -1000;
        $max = $options['max'] ?? 1000;
        
        if ($isDecimal) {
            return rand($min * 100, $max * 100) / 100;
        }
        
        return rand($min, $max);
    }

    private function generateDateValue(): string
    {
        $formats = [
            rand(1900, 2100), // Year only
            sprintf('%04d-%02d', rand(1900, 2100), rand(1, 12)), // Year-month
            sprintf('%04d-%02d-%02d', rand(1900, 2100), rand(1, 12), rand(1, 28)), // Full date
            'unknown', // Unknown
        ];
        
        return $formats[array_rand($formats)];
    }

    private function generateBooleanValue(): bool
    {
        return (bool) rand(0, 1);
    }

    private function generateSelectValue(array $options): string|array
    {
        $values = $options['values'] ?? ['option1', 'option2'];
        $isMulti = $options['multi'] ?? false;
        
        if ($isMulti) {
            $count = rand(1, count($values));
            return array_slice($values, 0, $count);
        }
        
        return $values[array_rand($values)];
    }

    private function generateReferenceValue(array $options): string|array
    {
        $isMulti = $options['multi'] ?? false;
        
        if ($isMulti) {
            return [
                (string) \Illuminate\Support\Str::uuid(),
                (string) \Illuminate\Support\Str::uuid(),
            ];
        }
        
        return (string) \Illuminate\Support\Str::uuid();
    }

    private function generateFileMetadata(): array
    {
        return [
            'path' => '/storage/files/' . \Illuminate\Support\Str::random(40) . '.jpg',
            'filename' => 'file_' . rand(1, 9999) . '.jpg',
            'size' => rand(1000, 10000000),
            'mime_type' => 'image/jpeg',
        ];
    }

    private function generateUrlValue(): string
    {
        $domains = ['example.com', 'test.org', 'demo.net'];
        $paths = ['', '/path', '/to/resource', '/api/v1/endpoint'];
        
        return 'https://' . $domains[array_rand($domains)] . $paths[array_rand($paths)];
    }

    private function generateEmailValue(): string
    {
        $domains = ['example.com', 'test.org', 'demo.net'];
        $usernames = ['user', 'test', 'admin', 'demo'];
        
        return $usernames[array_rand($usernames)] . '@' . $domains[array_rand($domains)];
    }
}
