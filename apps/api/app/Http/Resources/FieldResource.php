<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class FieldResource extends JsonResource
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
            'type' => $this->type,
            'name' => $this->name,
            'position' => $this->position,
            'options' => $this->options,
            'validation' => $this->validation,
            'table_id' => $this->table_id,
            'is_filterable' => $this->is_filterable,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
