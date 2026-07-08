<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Template extends Model
{
    protected $keyType = 'uuid';
    public $incrementing = false;

    protected $fillable = ['name', 'schema'];

    protected $casts = [
        'schema' => 'array',
    ];

    public function database(): BelongsTo
    {
        return $this->belongsTo(Database::class);
    }
}
