<?php

namespace Database\Factories;

use App\Models\Table;
use App\Models\View;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<View>
 */
class ViewFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'id' => (string) Str::uuid(),
            'table_id' => Table::factory(),
            'name' => fake()->word(),
            'type' => 'card',
            'config' => null,
        ];
    }
}
