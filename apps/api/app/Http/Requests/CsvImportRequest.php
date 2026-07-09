<?php

namespace App\Http\Requests;

use App\Models\Database;
use App\Models\Table;
use App\Models\Workspace;
use Illuminate\Foundation\Http\FormRequest;

class CsvImportRequest extends FormRequest
{
    public function authorize(): bool
    {
        $table = $this->route('table');
        $user = $this->user();

        if (! $table instanceof Table || ! $user) {
            return false;
        }

        $database = $table->database()->first();

        if (! $database instanceof Database) {
            return false;
        }

        // REQUIRES_REVIEW: CSV import creates user records and is restricted to R1 workspace owners.
        return Workspace::query()
            ->whereKey($database->workspace_id)
            ->whereHas('members', fn ($query) => $query
                ->where('user_id', $user->id)
                ->where('role', 'owner'))
            ->exists();
    }

    /**
     * @return array<string, list<string>>
     */
    public function rules(): array
    {
        return [
            'file' => ['required', 'file', 'max:5120'],
            'mapping' => ['required'],
        ];
    }
}
