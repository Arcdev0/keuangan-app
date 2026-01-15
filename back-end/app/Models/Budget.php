<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Budget extends Model
{
    protected $fillable = [
        'user_id',
        'budget_category_id',
        'period_year',
        'period_month',
        'amount',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'period_year' => 'integer',
        'period_month' => 'integer',
    ];

    /* ================= RELATIONS ================= */

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function category()
    {
        return $this->belongsTo(BudgetCategory::class, 'budget_category_id');
    }
}
