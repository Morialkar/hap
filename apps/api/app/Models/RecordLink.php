<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RecordLink extends Model
{
    public $incrementing = false;

    protected $primaryKey = null; // Composite key

    protected $fillable = [
        'from_record',
        'field_id',
        'to_record',
    ];

    public function fromRecord(): BelongsTo
    {
        return $this->belongsTo(Record::class, 'from_record');
    }

    public function field(): BelongsTo
    {
        return $this->belongsTo(Field::class, 'field_id');
    }

    public function toRecord(): BelongsTo
    {
        return $this->belongsTo(Record::class, 'to_record');
    }
}
