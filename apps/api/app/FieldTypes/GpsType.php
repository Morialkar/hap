<?php

namespace App\FieldTypes;

class GpsType implements FieldTypeInterface
{
    public function validate(mixed $value, array $options = []): array
    {
        if ($value === null || $value === '') {
            return ['valid' => true, 'error' => null];
        }

        if (! is_array($value)) {
            return ['valid' => false, 'error' => 'GPS value must include latitude and longitude'];
        }

        if (! array_key_exists('lat', $value) || ! array_key_exists('lng', $value)) {
            return ['valid' => false, 'error' => 'GPS value must include latitude and longitude'];
        }

        if (! is_numeric($value['lat']) || ! is_numeric($value['lng'])) {
            return ['valid' => false, 'error' => 'GPS latitude and longitude must be numbers'];
        }

        $lat = (float) $value['lat'];
        $lng = (float) $value['lng'];

        if ($lat < -90 || $lat > 90) {
            return ['valid' => false, 'error' => 'GPS latitude must be between -90 and 90'];
        }

        if ($lng < -180 || $lng > 180) {
            return ['valid' => false, 'error' => 'GPS longitude must be between -180 and 180'];
        }

        return ['valid' => true, 'error' => null];
    }

    public function normalize(mixed $value, array $options = []): mixed
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (! is_array($value) || ! isset($value['lat'], $value['lng'])) {
            return null;
        }

        if (! is_numeric($value['lat']) || ! is_numeric($value['lng'])) {
            return null;
        }

        return [
            'lat' => (float) $value['lat'],
            'lng' => (float) $value['lng'],
        ];
    }

    public function serialize(mixed $value, array $options = []): mixed
    {
        return $this->normalize($value, $options);
    }

    public function getType(): string
    {
        return 'gps';
    }
}
