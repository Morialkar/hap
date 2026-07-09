<?php

namespace App\Http\Requests;

use App\Models\Database;
use App\Models\Workspace;
use Illuminate\Foundation\Http\FormRequest;

class ExportTemplateRequest extends FormRequest
{
    public function authorize(): bool
    {
        $database = $this->route('database');
        $user = $this->user();

        if (! $database instanceof Database || ! $user) {
            return false;
        }

        // REQUIRES_REVIEW: workspace ownership gates template export before payload validation.
        return Workspace::query()
            ->whereKey($database->workspace_id)
            ->whereHas('members', fn ($query) => $query
                ->where('user_id', $user->id)
                ->where('role', 'owner'))
            ->exists();
    }

    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'template_version' => ['sometimes', 'string', 'regex:/^\d+\.\d+\.\d+$/'],
        ];
    }
}
