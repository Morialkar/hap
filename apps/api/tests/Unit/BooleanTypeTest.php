<?php

use App\FieldTypes\BooleanType;

test('validates null value', function () {
    $type = new BooleanType;
    $result = $type->validate(null);

    expect($result['valid'])->toBeTrue();
    expect($result['error'])->toBeNull();
});

test('validates boolean true', function () {
    $type = new BooleanType;
    $result = $type->validate(true);

    expect($result['valid'])->toBeTrue();
    expect($result['error'])->toBeNull();
});

test('validates boolean false', function () {
    $type = new BooleanType;
    $result = $type->validate(false);

    expect($result['valid'])->toBeTrue();
    expect($result['error'])->toBeNull();
});

test('validates integer 1', function () {
    $type = new BooleanType;
    $result = $type->validate(1);

    expect($result['valid'])->toBeTrue();
    expect($result['error'])->toBeNull();
});

test('validates integer 0', function () {
    $type = new BooleanType;
    $result = $type->validate(0);

    expect($result['valid'])->toBeTrue();
    expect($result['error'])->toBeNull();
});

test('validates string "1"', function () {
    $type = new BooleanType;
    $result = $type->validate('1');

    expect($result['valid'])->toBeTrue();
    expect($result['error'])->toBeNull();
});

test('validates string "0"', function () {
    $type = new BooleanType;
    $result = $type->validate('0');

    expect($result['valid'])->toBeTrue();
    expect($result['error'])->toBeNull();
});

test('rejects non-boolean value', function () {
    $type = new BooleanType;
    $result = $type->validate('not a boolean');

    expect($result['valid'])->toBeFalse();
    expect($result['error'])->toBe('Value must be a boolean');
});

test('normalizes null to null', function () {
    $type = new BooleanType;
    $result = $type->normalize(null);

    expect($result)->toBeNull();
});

test('normalizes boolean true to true', function () {
    $type = new BooleanType;
    $result = $type->normalize(true);

    expect($result)->toBeTrue();
});

test('normalizes boolean false to false', function () {
    $type = new BooleanType;
    $result = $type->normalize(false);

    expect($result)->toBeFalse();
});

test('normalizes 1 to true', function () {
    $type = new BooleanType;
    $result = $type->normalize(1);

    expect($result)->toBeTrue();
});

test('normalizes 0 to false', function () {
    $type = new BooleanType;
    $result = $type->normalize(0);

    expect($result)->toBeFalse();
});

test('normalizes "1" to true', function () {
    $type = new BooleanType;
    $result = $type->normalize('1');

    expect($result)->toBeTrue();
});

test('normalizes "0" to false', function () {
    $type = new BooleanType;
    $result = $type->normalize('0');

    expect($result)->toBeFalse();
});

test('returns correct type identifier', function () {
    $type = new BooleanType;

    expect($type->getType())->toBe('boolean');
});
