<?php

namespace App\Http\Controllers;

use App\Models\Database;
use App\Models\RecordPoint;
use Illuminate\Http\JsonResponse;

class DatabaseMapPointController extends Controller
{
    public function index(Database $database): JsonResponse
    {
        $points = RecordPoint::query()
            ->whereHas('record.table', fn ($query) => $query->where('database_id', $database->id))
            ->with(['record.table.fields', 'field'])
            ->get()
            ->map(function (RecordPoint $point) {
                $titleField = $point->record->table->fields->first(fn ($field) => ($field->options['is_title'] ?? false) === true)
                    ?? $point->record->table->fields->firstWhere('type', 'title');

                return [
                    'record_id' => $point->record_id,
                    'table_id' => $point->record->table_id,
                    'table_name' => $point->record->table->name,
                    'field_id' => $point->field_id,
                    'field_name' => $point->field->name,
                    'latitude' => $point->latitude,
                    'longitude' => $point->longitude,
                    'record_title' => $titleField ? (string) ($point->record->data[$titleField->name] ?? $point->record_id) : $point->record_id,
                ];
            });

        return response()->json(['data' => $points]);
    }
}
