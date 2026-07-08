<?php

use App\FieldTypes\SelectType;

test('validates null value', function () {
    $type = new SelectType();
    $result = $type->validate(null);

    expect($result['valid'])->toBeTrue();
    expect($result['error'])->toBeNull();
});

test('validates single select with valid option', function () {
    $type = new SelectType();
    $result = $type->validate('option1', ['values' => ['option1', 'option2']]);

    expect($result['valid'])->toBeTrue();
    expect($result['error'])->toBeNull();
});

test('rejects single select with invalid option', function () {
    $type = new SelectType();
    $result = $type->validate('invalid', ['values' => ['option1', 'option2']]);

    expect($result['valid'])->toBeFalse();
    expect($result['error'])->toBe('Invalid option: invalid');
});

test('rejects select without defined values', function () {
    $type = new SelectType();
    $result = $type->validate('option1', []);

    expect($result['valid'])->toBeFalse();
    expect($result['error'])->toBe('Select field must have defined values');
});

test('validates multi-select with valid options', function () {
    $type = new SelectType();
    $result = $type->validate(['option1', 'option2'], ['values' => ['option1', 'option2', 'option3'], 'multi' => true]);

    expect($result['valid'])->toBeTrue();
    expect($result['error'])->toBeNull();
});

test('rejects multi-select with invalid option', function () {
    $type = new SelectType();
    $result = $type->validate(['option1', 'invalid'], ['values' => ['option1', 'option2'], 'multi' => true]);

    expect($result['valid'])->toBeFalse();
    expect($result['error'])->toBe('Invalid option: invalid');
});

test('rejects multi-select when value is not array', function () {
    $type = new SelectType();
    $result = $type->validate('option1', ['values' => ['option1', 'option2'], 'multi' => true]);

    expect($result['valid'])->toBeFalse();
    expect($result['error'])->toBe('Value must be an array for multi-select');
});

test('normalizes null to null', function () {
    $type = new SelectType();
    $result = $type->normalize(null);

    expect($result)->toBeNull();
});

test('normalizes single select value', function () {
    $type = new SelectType();
    $result = $type->normalize('option1', ['values' => ['option1', 'option2']]);

    expect($result)->toBe('option1');
});

test('normalizes multi-select array', function () {
    $type = new SelectType();
    $result = $type->normalize(['option1', 'option2'], ['values' => ['option1', 'option2'], 'multi' => true]);

    expect($result)->toBe(['option1', 'option2']);
});

test('filters null values from multi-select array', function () {
    $type = new SelectType();
    $result = $type->normalize(['option1', null, 'option2', ''], ['values' => ['option1', 'option2'], 'multi' => true]);

    expect($result)->toBe(['option1', 'option2']);
});

test('returns correct type identifier', function () {
    $type = new SelectType();

    expect($type->getType())->toBe('select');
});
