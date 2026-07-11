<?php

namespace App\Services;

use App\Models\Database;
use App\Models\Record;
use App\Models\RecordPoint;
use Illuminate\Support\Facades\DB;

class RecordPointService
{
    public function backfillDatabase(Database $database): int
    {
        $records = Record::query()
            ->whereHas('table', fn ($query) => $query->where('database_id', $database->id))
            ->with('table.fields')
            ->get();

        foreach ($records as $record) {
            $this->syncPoints($record);
        }

        return $records->count();
    }

    public function syncPoints(Record $record): void
    {
        $table = $record->table()->with('fields')->firstOrFail();
        $gpsFields = $table->fields->where('type', 'gps');

        DB::transaction(function () use ($record, $gpsFields) {
            RecordPoint::where('record_id', $record->id)->delete();

            foreach ($gpsFields as $field) {
                $value = $record->data[$field->name] ?? null;
                if (! is_array($value) || ! is_numeric($value['lat'] ?? null) || ! is_numeric($value['lng'] ?? null)) {
                    continue;
                }

                $latitude = (float) $value['lat'];
                $longitude = (float) $value['lng'];
                $point = RecordPoint::create([
                    'record_id' => $record->id,
                    'field_id' => $field->id,
                    'latitude' => $latitude,
                    'longitude' => $longitude,
                    'geog' => sprintf('POINT(%F %F)', $longitude, $latitude),
                ]);

                if (DB::getDriverName() === 'pgsql') {
                    DB::table('record_points')
                        ->where('record_id', $point->record_id)
                        ->where('field_id', $point->field_id)
                        ->update([
                            'geog' => DB::raw(sprintf('ST_SetSRID(ST_MakePoint(%F, %F), 4326)::geography', $longitude, $latitude)),
                        ]);
                }
            }
        });
    }

    public function deletePoints(Record $record): void
    {
        RecordPoint::where('record_id', $record->id)->delete();
    }
}
