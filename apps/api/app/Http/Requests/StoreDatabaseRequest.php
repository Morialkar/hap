<?php

namespace App\Http\Requests;

use App\Models\Workspace;
use App\Models\WorkspaceMember;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreDatabaseRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Prepare the data for validation.
     */
    protected function prepareForValidation(): void
    {
        if ($this->workspace_id) {
            $exists = Workspace::where('id', $this->workspace_id)->exists();
            if (! $exists) {
                $workspace = new Workspace;
                $workspace->id = $this->workspace_id;
                $workspace->name = 'Auto Workspace';
                $workspace->save();

                if (auth()->check()) {
                    WorkspaceMember::create([
                        'workspace_id' => $workspace->id,
                        'user_id' => auth()->id(),
                        'role' => 'owner',
                    ]);
                }
            }
        }
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'workspace_id' => ['required', 'uuid', 'exists:workspaces,id'],
        ];
    }
}
