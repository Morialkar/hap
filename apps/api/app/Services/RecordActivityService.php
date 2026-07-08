<?php

namespace App\Services;

use App\Models\Record;
use App\Models\RecordActivityLog;
use App\Models\User;

class RecordActivityService
{
    /**
     * Log record creation.
     */
    public function logCreate(Record $record, User $user): void
    {
        RecordActivityLog::create([
            'record_id' => $record->id,
            'user_id' => $user->id,
            'action' => 'create',
            'changes' => [
                'data' => $record->data,
                'version' => $record->version,
            ],
        ]);
    }

    /**
     * Log record update with field-level diff.
     */
    public function logUpdate(Record $record, User $user, array $oldData, array $newData): void
    {
        $changes = $this->computeDiff($oldData, $newData);

        RecordActivityLog::create([
            'record_id' => $record->id,
            'user_id' => $user->id,
            'action' => 'update',
            'changes' => [
                'diff' => $changes,
                'old_version' => $record->version - 1,
                'new_version' => $record->version,
            ],
        ]);
    }

    /**
     * Log record deletion.
     */
    public function logDelete(Record $record, User $user): void
    {
        RecordActivityLog::create([
            'record_id' => $record->id,
            'user_id' => $user->id,
            'action' => 'delete',
            'changes' => [
                'data' => $record->data,
                'version' => $record->version,
            ],
        ]);
    }

    /**
     * Log record restore.
     */
    public function logRestore(Record $record, User $user): void
    {
        RecordActivityLog::create([
            'record_id' => $record->id,
            'user_id' => $user->id,
            'action' => 'restore',
            'changes' => [
                'data' => $record->data,
                'version' => $record->version,
            ],
        ]);
    }

    /**
     * Compute field-level diff between two data arrays.
     */
    private function computeDiff(array $oldData, array $newData): array
    {
        $diff = [];

        // Find added and changed fields
        foreach ($newData as $field => $newValue) {
            $oldValue = $oldData[$field] ?? null;

            if (!array_key_exists($field, $oldData)) {
                $diff[$field] = [
                    'type' => 'added',
                    'new' => $newValue,
                ];
            } elseif ($oldValue !== $newValue) {
                $diff[$field] = [
                    'type' => 'changed',
                    'old' => $oldValue,
                    'new' => $newValue,
                ];
            }
        }

        // Find removed fields
        foreach ($oldData as $field => $oldValue) {
            if (!array_key_exists($field, $newData)) {
                $diff[$field] = [
                    'type' => 'removed',
                    'old' => $oldValue,
                ];
            }
        }

        return $diff;
    }

    /**
     * Get activity history for a record.
     */
    public function getHistory(Record $record, int $page = 1, int $perPage = 20): array
    {
        $logs = RecordActivityLog::where('record_id', $record->id)
            ->with('user')
            ->orderBy('created_at', 'desc')
            ->paginate($perPage, ['*'], 'page', $page);

        return [
            'data' => $logs->map(function ($log) {
                return [
                    'id' => $log->id,
                    'action' => $log->action,
                    'changes' => $log->changes,
                    'user' => [
                        'id' => $log->user->id,
                        'name' => $log->user->name,
                    ],
                    'created_at' => $log->created_at->toISOString(),
                ];
            })->toArray(),
            'pagination' => [
                'current_page' => $logs->currentPage(),
                'per_page' => $logs->perPage(),
                'total' => $logs->total(),
                'last_page' => $logs->lastPage(),
            ],
        ];
    }
}
