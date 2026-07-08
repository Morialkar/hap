<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Table extends Model
{
    use HasFactory;

    protected $keyType = 'uuid';
    public $incrementing = false;

    protected $fillable = ['name', 'database_id'];

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

    public function fields(): HasMany
    {
        return $this->hasMany(Field::class);
    }

    public function views(): HasMany
    {
        return $this->hasMany(View::class);
    }

    public function reports(): HasMany
    {
        return $this->hasMany(Report::class);
    }
}
