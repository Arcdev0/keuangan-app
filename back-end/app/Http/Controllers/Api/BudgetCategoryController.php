<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BudgetCategory;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class BudgetCategoryController extends Controller
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

        return response()->json([
            'data' => $user->budgetCategories()
                ->where('is_active', true)
                ->orderBy('name')
                ->get(),
        ]);
    }

    public function store(Request $request)
    {
        $user = $request->user();
        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:120',
                Rule::unique('budget_categories', 'name')
                    ->where(fn ($query) => $query
                        ->where('user_id', $user->id)
                        ->where('is_active', true)),
            ],
        ]);

        $category = $user->budgetCategories()->create([
            'name' => trim($validated['name']),
            'icon' => 'tag',
            'color' => '#0056b3',
            'is_active' => true,
        ]);

        return response()->json([
            'message' => 'Kategori anggaran berhasil dibuat',
            'data' => $category,
        ], 201);
    }

    public function destroy(Request $request, BudgetCategory $budgetCategory)
    {
        $user = $request->user();

        if ($budgetCategory->user_id !== $user->id || ! $budgetCategory->is_active) {
            abort(404);
        }

        if ($budgetCategory->name === 'Lainnya') {
            return response()->json([
                'message' => 'Kategori Lainnya tidak bisa dihapus karena dipakai sebagai fallback.',
            ], 422);
        }

        $fallbackCategory = $user->budgetCategories()->firstOrCreate(
            ['name' => 'Lainnya'],
            [
                'icon' => 'more-horizontal',
                'color' => '#64748b',
                'is_active' => true,
            ]
        );

        DB::transaction(function () use ($budgetCategory, $fallbackCategory, $user) {
            $user->transactions()
                ->where('budget_category_id', $budgetCategory->id)
                ->update(['budget_category_id' => $fallbackCategory->id]);

            $budgetCategory->budgets()->delete();
            $budgetCategory->update(['is_active' => false]);
        });

        return response()->json([
            'message' => 'Kategori berhasil dihapus. Transaksi lama dipindahkan ke Lainnya.',
        ]);
    }
}
