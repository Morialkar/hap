<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TableResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'database_id' => $this->database_id,
            'is_front_facing' => (bool) $this->is_front_facing,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
