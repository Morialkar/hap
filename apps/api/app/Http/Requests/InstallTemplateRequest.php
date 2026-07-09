<?php

namespace App\Http\Requests;

use App\Models\Workspace;
use Illuminate\Foundation\Http\FormRequest;

class InstallTemplateRequest extends FormRequest
{
    public function authorize(): bool
    {
        $workspace = $this->route('workspace');
        $user = $this->user();

        if (! $workspace instanceof Workspace || ! $user) {
            return false;
        }

        // REQUIRES_REVIEW: workspace ownership gates template installation before payload validation.
        return Workspace::query()
            ->whereKey($workspace->id)
            ->whereHas('members', fn ($query) => $query
                ->where('user_id', $user->id)
                ->where('role', 'owner'))
            ->exists();
    }

    public function rules(): array
    {
        return [
            'format_version' => ['required', 'integer', 'in:1'],
            'template_version' => ['required', 'string', 'regex:/^\d+\.\d+\.\d+$/'],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'payload' => ['required', 'array'],
            'payload.database' => ['required', 'array'],
            'payload.database.name' => ['required', 'string', 'max:255'],
            'payload.database.locale' => ['sometimes', 'string', 'max:32'],
            'payload.tables' => ['present', 'array'],
            'payload.demo_records' => ['sometimes', 'array'],
        ];
    }
}
