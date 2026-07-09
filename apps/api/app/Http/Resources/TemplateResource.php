<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TemplateResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'database_id' => $this->database_id,
            'source_database_id' => $this->source_database_id,
            'name' => $this->name,
            'description' => $this->description,
            'format_version' => $this->format_version,
            'template_version' => $this->template_version,
            'payload' => $this->payload,
            'includes_demo_records' => $this->includes_demo_records,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
