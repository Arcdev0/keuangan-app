<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Transaction extends Model
{
    protected $fillable = [
        'user_id',
        'type',
        'wallet_id',
        'to_wallet_id',
        'budget_category_id',
        'amount',
        'trx_date',
        'note',
        'status',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'trx_date' => 'datetime',
    ];

    /* ================= RELATIONS ================= */

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function wallet()
    {
        return $this->belongsTo(Wallet::class);
    }

    public function toWallet()
    {
        return $this->belongsTo(Wallet::class, 'to_wallet_id');
    }

    public function category()
    {
        return $this->belongsTo(BudgetCategory::class, 'budget_category_id');
    }

    public function attachments()
    {
        return $this->hasMany(TransactionAttachment::class);
    }
}
