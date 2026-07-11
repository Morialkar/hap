<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RecordResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $data = $this->data ?? [];
        $table = $this->table;
        if ($table) {
            $validationService = app(\App\Services\RecordValidationService::class);
            $data = $validationService->computeCompoundFields($table, $data);
        }

        return [
            'id' => $this->id,
            'table_id' => $this->table_id,
            'data' => $data,
            'version' => $this->version,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
