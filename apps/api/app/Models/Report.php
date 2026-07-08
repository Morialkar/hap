<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Report extends Model
{
    protected $keyType = 'uuid';
    public $incrementing = false;

    protected $fillable = ['name', 'query', 'layout'];

    protected $casts = [
        'query' => 'array',
        'layout' => 'array',
    ];

    public function table(): BelongsTo
    {
        return $this->belongsTo(Table::class);
    }
}
