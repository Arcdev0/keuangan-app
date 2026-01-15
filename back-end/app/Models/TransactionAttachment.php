<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TransactionAttachment extends Model
{
    protected $fillable = [
        'transaction_id',
        'file_path',
        'caption',
        'sort_order',
    ];

    protected $casts = [
        'sort_order' => 'integer',
    ];

    /* ================= RELATIONS ================= */

    public function transaction()
    {
        return $this->belongsTo(Transaction::class);
    }
}
