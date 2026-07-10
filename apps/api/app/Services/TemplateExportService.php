<?php

namespace App\Services;

use App\Models\Database;
use App\Models\Field;
use App\Models\Table;
use Illuminate\Support\Str;

class TemplateExportService
{
    public function export(Database $database): array
    {
        $database->load([
            'tables.fields',
            'tables.views',
            'tables.reports',
        ]);

        $tableKeys = $this->tableKeys($database->tables);
        $fieldKeys = $this->fieldKeys($database->tables);
        $idMap = array_merge($tableKeys, $fieldKeys);

        return [
            'database' => [
                'name' => $database->name,
                'locale' => $database->locale ?? 'fr-CA',
            ],
            'tables' => $database->tables
                ->sortBy(fn (Table $table) => $table->name)
                ->values()
                ->map(fn (Table $table) => [
                    'key' => $tableKeys[$table->id],
                    'name' => $table->name,
                    'is_front_facing' => (bool) $table->is_front_facing,
                    'fields' => $table->fields
                        ->sortBy([
                            ['position', 'asc'],
                            ['name', 'asc'],
                        ])
                        ->values()
                        ->map(fn (Field $field) => [
                            'key' => $fieldKeys[$field->id],
                            'name' => $field->name,
                            'type' => $field->type,
                            'position' => $field->position ?? 0,
                            'options' => $this->replaceIds($field->options ?? [], $idMap),
                            'validation' => $field->validation ?? [],
                        ])
                        ->all(),
                    'views' => $table->views
                        ->sortBy(fn ($view) => $view->name)
                        ->values()
                        ->map(fn ($view) => [
                            'key' => $this->keyFromName($view->name),
                            'name' => $view->name,
                            'type' => $view->type,
                            'config' => $this->replaceIds($view->config ?? [], $idMap),
                        ])
                        ->all(),
                    'reports' => $table->reports
                        ->sortBy(fn ($report) => $report->name)
                        ->values()
                        ->map(fn ($report) => [
                            'key' => $this->keyFromName($report->name),
                            'name' => $report->name,
                            'query' => $this->replaceIds($report->query ?? [], $idMap),
                            'layout' => $this->replaceIds($report->layout ?? [], $idMap),
                        ])
                        ->all(),
                ])
                ->all(),
            'demo_records' => [],
        ];
    }

    private function tableKeys($tables): array
    {
        $used = [];
        $keys = [];

        foreach ($tables->sortBy(fn (Table $table) => $table->name)->values() as $index => $table) {
            $keys[$table->id] = $this->uniqueKey($table->name ?: 'table-'.($index + 1), $used);
        }

        return $keys;
    }

    private function fieldKeys($tables): array
    {
        $keys = [];

        foreach ($tables as $table) {
            $used = [];

            foreach ($table->fields->sortBy([['position', 'asc'], ['name', 'asc']])->values() as $index => $field) {
                $keys[$field->id] = $this->uniqueKey($field->name ?: 'field-'.($index + 1), $used);
            }
        }

        return $keys;
    }

    private function uniqueKey(string $name, array &$used): string
    {
        $base = $this->keyFromName($name);
        $key = $base;
        $suffix = 2;

        while (isset($used[$key])) {
            $key = $base.'-'.$suffix;
            $suffix++;
        }

        $used[$key] = true;

        return $key;
    }

    private function keyFromName(string $name): string
    {
        return Str::slug($name) ?: 'item';
    }

    private function replaceIds(mixed $value, array $idMap): mixed
    {
        if (is_string($value)) {
            return $idMap[$value] ?? $value;
        }

        if (! is_array($value)) {
            return $value;
        }

        $replaced = [];

        foreach ($value as $key => $item) {
            $replaced[$key] = $this->replaceIds($item, $idMap);
        }

        return $replaced;
    }
}
