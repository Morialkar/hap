<?php

use App\FieldTypes\ShortTextType;

test('validates null value', function () {
    $type = new ShortTextType;
    $result = $type->validate(null);

    expect($result['valid'])->toBeTrue();
    expect($result['error'])->toBeNull();
});

test('validates empty string', function () {
    $type = new ShortTextType;
    $result = $type->validate('');

    expect($result['valid'])->toBeTrue();
    expect($result['error'])->toBeNull();
});

test('validates string within max length', function () {
    $type = new ShortTextType;
    $result = $type->validate('hello', ['max_length' => 10]);

    expect($result['valid'])->toBeTrue();
    expect($result['error'])->toBeNull();
});

test('rejects string exceeding max length', function () {
    $type = new ShortTextType;
    $result = $type->validate('hello world', ['max_length' => 10]);

    expect($result['valid'])->toBeFalse();
    expect($result['error'])->toBe('Value must not exceed 10 characters');
});

test('rejects non-string value', function () {
    $type = new ShortTextType;
    $result = $type->validate(123);

    expect($result['valid'])->toBeFalse();
    expect($result['error'])->toBe('Value must be a string');
});

test('normalizes null to null', function () {
    $type = new ShortTextType;
    $result = $type->normalize(null);

    expect($result)->toBeNull();
});

test('normalizes empty string to null', function () {
    $type = new ShortTextType;
    $result = $type->normalize('');

    expect($result)->toBeNull();
});

test('normalizes string with trim', function () {
    $type = new ShortTextType;
    $result = $type->normalize('  hello  ');

    expect($result)->toBe('hello');
});

test('normalizes number to string', function () {
    $type = new ShortTextType;
    $result = $type->normalize(123);

    expect($result)->toBe('123');
});

test('serializes same as normalize', function () {
    $type = new ShortTextType;
    $value = '  hello  ';

    expect($type->serialize($value))->toBe($type->normalize($value));
});

test('returns correct type identifier', function () {
    $type = new ShortTextType;

    expect($type->getType())->toBe('text');
});

test('uses default max length of 255', function () {
    $type = new ShortTextType;
    $longString = str_repeat('a', 256);
    $result = $type->validate($longString);

    expect($result['valid'])->toBeFalse();
});

test('handles unicode characters correctly', function () {
    $type = new ShortTextType;
    $result = $type->validate('éÈœ', ['max_length' => 10]);

    expect($result['valid'])->toBeTrue();
});
