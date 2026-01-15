<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BudgetCategory extends Model
{
    protected $fillable = [
        'user_id',
        'name',
        'icon',
        'color',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    /* ================= RELATIONS ================= */

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function budgets()
    {
        return $this->hasMany(Budget::class);
    }

    public function transactions()
    {
        return $this->hasMany(Transaction::class);
    }
}
