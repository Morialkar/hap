<?php

use App\FieldTypes\GpsType;

test('validates null value', function () {
    $type = new GpsType;
    $result = $type->validate(null);

    expect($result['valid'])->toBeTrue();
    expect($result['error'])->toBeNull();
});

test('validates latitude and longitude pair', function () {
    $type = new GpsType;
    $result = $type->validate(['lat' => 45.5017, 'lng' => -73.5673]);

    expect($result['valid'])->toBeTrue();
    expect($result['error'])->toBeNull();
});

test('rejects missing coordinate', function () {
    $type = new GpsType;
    $result = $type->validate(['lat' => 45.5017]);

    expect($result['valid'])->toBeFalse();
    expect($result['error'])->toBe('GPS value must include latitude and longitude');
});

test('rejects out of range latitude', function () {
    $type = new GpsType;
    $result = $type->validate(['lat' => 91, 'lng' => -73.5673]);

    expect($result['valid'])->toBeFalse();
    expect($result['error'])->toBe('GPS latitude must be between -90 and 90');
});

test('rejects out of range longitude', function () {
    $type = new GpsType;
    $result = $type->validate(['lat' => 45.5017, 'lng' => -181]);

    expect($result['valid'])->toBeFalse();
    expect($result['error'])->toBe('GPS longitude must be between -180 and 180');
});

test('normalizes string coordinates to floats', function () {
    $type = new GpsType;
    $result = $type->normalize(['lat' => '45.5017', 'lng' => '-73.5673']);

    expect($result)->toBe([
        'lat' => 45.5017,
        'lng' => -73.5673,
    ]);
});

test('returns correct type identifier', function () {
    $type = new GpsType;

    expect($type->getType())->toBe('gps');
});
