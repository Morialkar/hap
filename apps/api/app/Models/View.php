<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class View extends Model
{
    protected $keyType = 'uuid';
    public $incrementing = false;

    protected $fillable = ['name', 'type', 'config'];

    protected $casts = [
        'config' => 'array',
    ];

    public function table(): BelongsTo
    {
        return $this->belongsTo(Table::class);
    }
}
