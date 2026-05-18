<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Budget;
use App\Models\BudgetCategory;
use App\Models\Transaction;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class BudgetController extends Controller
{
    private array $defaultCategories = [
        ['name' => 'Makanan', 'icon' => 'utensils', 'color' => '#ef4444'],
        ['name' => 'Transportasi', 'icon' => 'car', 'color' => '#f59e0b'],
        ['name' => 'Belanja', 'icon' => 'shopping-bag', 'color' => '#8b5cf6'],
        ['name' => 'Tagihan', 'icon' => 'receipt', 'color' => '#0ea5e9'],
        ['name' => 'Gaji', 'icon' => 'wallet', 'color' => '#22c55e'],
        ['name' => 'Lainnya', 'icon' => 'more-horizontal', 'color' => '#64748b'],
    ];

    public function index(Request $request)
    {
        $user = $request->user();
        $validated = $request->validate([
            'year' => ['nullable', 'integer', 'min:2000', 'max:2100'],
            'month' => ['nullable', 'integer', 'min:1', 'max:12'],
        ]);

        $year = (int) ($validated['year'] ?? now()->year);
        $month = (int) ($validated['month'] ?? now()->month);

        foreach ($this->defaultCategories as $category) {
            $user->budgetCategories()->firstOrCreate(
                ['name' => $category['name']],
                [
                    'icon' => $category['icon'],
                    'color' => $category['color'],
                    'is_active' => true,
                ]
            );
        }

        $categories = BudgetCategory::where('user_id', $user->id)
            ->where('is_active', true)
            ->orderBy('name')
            ->get();

        $budgets = Budget::where('user_id', $user->id)
            ->where('period_year', $year)
            ->where('period_month', $month)
            ->get()
            ->keyBy('budget_category_id');

        $spentByCategory = Transaction::query()
            ->select('budget_category_id', DB::raw('SUM(amount) as spent_amount'))
            ->where('user_id', $user->id)
            ->where('type', 'expense')
            ->whereYear('trx_date', $year)
            ->whereMonth('trx_date', $month)
            ->whereNotNull('budget_category_id')
            ->groupBy('budget_category_id')
            ->pluck('spent_amount', 'budget_category_id');

        $items = $categories->map(function (BudgetCategory $category) use ($budgets, $spentByCategory) {
            $budget = $budgets->get($category->id);
            $limit = (float) ($budget?->amount ?? 0);
            $spent = (float) ($spentByCategory[$category->id] ?? 0);

            return [
                'budget_id' => $budget?->id,
                'category_id' => $category->id,
                'category_name' => $category->name,
                'category_icon' => $category->icon,
                'category_color' => $category->color,
                'limit' => $limit,
                'spent' => $spent,
                'remaining' => max($limit - $spent, 0),
                'percentage' => $limit > 0 ? min(round(($spent / $limit) * 100), 999) : 0,
            ];
        })->values();

        $totalLimit = $items->sum('limit');
        $totalSpent = $items->sum('spent');

        return response()->json([
            'data' => [
                'period_year' => $year,
                'period_month' => $month,
                'total_limit' => $totalLimit,
                'total_spent' => $totalSpent,
                'total_remaining' => max($totalLimit - $totalSpent, 0),
                'percentage' => $totalLimit > 0 ? min(round(($totalSpent / $totalLimit) * 100), 999) : 0,
                'items' => $items,
            ],
        ]);
    }

    public function store(Request $request)
    {
        $user = $request->user();
        $validated = $request->validate([
            'budget_category_id' => [
                'required',
                Rule::exists('budget_categories', 'id')->where(fn ($query) => $query
                    ->where('user_id', $user->id)
                    ->where('is_active', true)),
            ],
            'period_year' => ['required', 'integer', 'min:2000', 'max:2100'],
            'period_month' => ['required', 'integer', 'min:1', 'max:12'],
            'amount' => ['required', 'numeric', 'min:0'],
        ]);

        $budget = Budget::updateOrCreate(
            [
                'user_id' => $user->id,
                'budget_category_id' => $validated['budget_category_id'],
                'period_year' => $validated['period_year'],
                'period_month' => $validated['period_month'],
            ],
            [
                'amount' => $validated['amount'],
            ]
        );

        return response()->json([
            'message' => 'Anggaran berhasil disimpan',
            'data' => $budget->load('category'),
        ], 201);
    }
}
