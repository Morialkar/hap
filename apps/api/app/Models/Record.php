<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Symfony\Component\Uid\Ulid;

class Record extends Model
{
    use HasFactory, SoftDeletes;

    protected $keyType = 'ulid';

    public $incrementing = false;

    protected $fillable = [
        'table_id',
        'data',
        'version',
    ];

    protected $casts = [
        'data' => 'array',
        'version' => 'integer',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = (string) new Ulid;
            }
        });
    }

    public function table(): BelongsTo
    {
        return $this->belongsTo(Table::class);
    }

    public function linksFrom(): HasMany
    {
        return $this->hasMany(RecordLink::class, 'from_record');
    }

    public function linksTo(): HasMany
    {
        return $this->hasMany(RecordLink::class, 'to_record');
    }
}
