<?php

use App\FieldTypes\DateType;

test('validates null value', function () {
    $type = new DateType();
    $result = $type->validate(null);

    expect($result['valid'])->toBeTrue();
    expect($result['error'])->toBeNull();
});

test('validates year-only format', function () {
    $type = new DateType();
    $result = $type->validate('2023');

    expect($result['valid'])->toBeTrue();
    expect($result['error'])->toBeNull();
});

test('validates year-month format', function () {
    $type = new DateType();
    $result = $type->validate('2023-07');

    expect($result['valid'])->toBeTrue();
    expect($result['error'])->toBeNull();
});

test('validates full date format', function () {
    $type = new DateType();
    $result = $type->validate('2023-07-08');

    expect($result['valid'])->toBeTrue();
    expect($result['error'])->toBeNull();
});

test('validates unknown value', function () {
    $type = new DateType();
    $result = $type->validate('unknown');

    expect($result['valid'])->toBeTrue();
    expect($result['error'])->toBeNull();
});

test('rejects invalid format', function () {
    $type = new DateType();
    $result = $type->validate('2023/07/08');

    expect($result['valid'])->toBeFalse();
    expect($result['error'])->toBe('Date must be in YYYY, YYYY-MM, or YYYY-MM-DD format, or "unknown"');
});

test('rejects invalid month', function () {
    $type = new DateType();
    $result = $type->validate('2023-13');

    expect($result['valid'])->toBeFalse();
    expect($result['error'])->toBe('Invalid month');
});

test('rejects invalid day', function () {
    $type = new DateType();
    $result = $type->validate('2023-07-32');

    expect($result['valid'])->toBeFalse();
    expect($result['error'])->toBe('Invalid day');
});

test('rejects non-string value', function () {
    $type = new DateType();
    $result = $type->validate(123);

    expect($result['valid'])->toBeFalse();
    expect($result['error'])->toBe('Value must be a string');
});

test('normalizes null to null', function () {
    $type = new DateType();
    $result = $type->normalize(null);

    expect($result)->toBeNull();
});

test('normalizes unknown to unknown', function () {
    $type = new DateType();
    $result = $type->normalize('unknown');

    expect($result)->toBe('unknown');
});

test('normalizes year format', function () {
    $type = new DateType();
    $result = $type->normalize('2023');

    expect($result)->toBe('2023');
});

test('normalizes year-month format', function () {
    $type = new DateType();
    $result = $type->normalize('2023-07');

    expect($result)->toBe('2023-07');
});

test('normalizes full date format', function () {
    $type = new DateType();
    $result = $type->normalize('2023-07-08');

    expect($result)->toBe('2023-07-08');
});

test('returns correct type identifier', function () {
    $type = new DateType();

    expect($type->getType())->toBe('date');
});
