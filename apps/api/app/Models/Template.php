<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class Template extends Model
{
    protected $keyType = 'uuid';

    public $incrementing = false;

    protected $fillable = [
        'database_id',
        'source_database_id',
        'name',
        'description',
        'format_version',
        'template_version',
        'schema',
        'payload',
        'includes_demo_records',
    ];

    protected $casts = [
        'schema' => 'array',
        'payload' => 'array',
        'includes_demo_records' => 'boolean',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }
        });
    }

    public function database(): BelongsTo
    {
        return $this->belongsTo(Database::class);
    }

    public function sourceDatabase(): BelongsTo
    {
        return $this->belongsTo(Database::class, 'source_database_id');
    }
}
