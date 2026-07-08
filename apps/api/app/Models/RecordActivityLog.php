<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RecordActivityLog extends Model
{
    protected $table = 'record_activity_log';

    protected $fillable = [
        'record_id',
        'user_id',
        'action',
        'changes',
    ];

    protected $casts = [
        'changes' => 'array',
    ];

    public function record(): BelongsTo
    {
        return $this->belongsTo(Record::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
