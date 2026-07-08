<?php

use App\FieldTypes\NumberType;

test('validates null value', function () {
    $type = new NumberType();
    $result = $type->validate(null);

    expect($result['valid'])->toBeTrue();
    expect($result['error'])->toBeNull();
});

test('validates integer', function () {
    $type = new NumberType();
    $result = $type->validate(42);

    expect($result['valid'])->toBeTrue();
    expect($result['error'])->toBeNull();
});

test('validates decimal when decimal option is true', function () {
    $type = new NumberType();
    $result = $type->validate(3.14, ['decimal' => true]);

    expect($result['valid'])->toBeTrue();
    expect($result['error'])->toBeNull();
});

test('rejects decimal when decimal option is false', function () {
    $type = new NumberType();
    $result = $type->validate(3.14, ['decimal' => false]);

    expect($result['valid'])->toBeFalse();
    expect($result['error'])->toBe('Value must be an integer');
});

test('rejects non-numeric value', function () {
    $type = new NumberType();
    $result = $type->validate('not a number');

    expect($result['valid'])->toBeFalse();
    expect($result['error'])->toBe('Value must be a number');
});

test('enforces minimum value', function () {
    $type = new NumberType();
    $result = $type->validate(5, ['min' => 10]);

    expect($result['valid'])->toBeFalse();
    expect($result['error'])->toBe('Value must be at least 10');
});

test('enforces maximum value', function () {
    $type = new NumberType();
    $result = $type->validate(15, ['max' => 10]);

    expect($result['valid'])->toBeFalse();
    expect($result['error'])->toBe('Value must be at most 10');
});

test('allows value within min and max', function () {
    $type = new NumberType();
    $result = $type->validate(5, ['min' => 0, 'max' => 10]);

    expect($result['valid'])->toBeTrue();
});

test('normalizes null to null', function () {
    $type = new NumberType();
    $result = $type->normalize(null);

    expect($result)->toBeNull();
});

test('normalizes string number to integer', function () {
    $type = new NumberType();
    $result = $type->normalize('42');

    expect($result)->toBe(42);
});

test('normalizes string number to decimal when decimal option is true', function () {
    $type = new NumberType();
    $result = $type->normalize('3.14', ['decimal' => true]);

    expect($result)->toBe(3.14);
});

test('returns correct type identifier', function () {
    $type = new NumberType();

    expect($type->getType())->toBe('number');
});
