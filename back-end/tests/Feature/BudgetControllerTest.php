<?php

namespace Tests\Feature;

use App\Models\BudgetCategory;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BudgetControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_create_budget_and_see_monthly_spending_summary(): void
    {
        $user = User::factory()->create();
        $category = BudgetCategory::create([
            'user_id' => $user->id,
            'name' => 'Makanan',
            'is_active' => true,
        ]);
        $wallet = Wallet::create([
            'user_id' => $user->id,
            'name' => 'Tunai',
            'type' => 'cash',
            'opening_balance' => 500000,
            'current_balance' => 500000,
            'is_default' => true,
            'is_active' => true,
        ]);

        Transaction::create([
            'user_id' => $user->id,
            'type' => 'expense',
            'wallet_id' => $wallet->id,
            'budget_category_id' => $category->id,
            'amount' => 25000,
            'trx_date' => '2026-05-18',
            'status' => 'completed',
        ]);

        Sanctum::actingAs($user);

        $this->postJson('/api/budgets', [
            'budget_category_id' => $category->id,
            'period_year' => 2026,
            'period_month' => 5,
            'amount' => 100000,
        ])->assertCreated();

        $response = $this->getJson('/api/budgets?year=2026&month=5');

        $response
            ->assertOk()
            ->assertJsonPath('data.total_limit', 100000)
            ->assertJsonPath('data.total_spent', 25000)
            ->assertJsonPath('data.total_remaining', 75000)
            ->assertJsonPath('data.percentage', 25)
            ->assertJsonFragment([
                'category_name' => 'Makanan',
                'limit' => 100000,
                'spent' => 25000,
                'remaining' => 75000,
                'percentage' => 25,
            ]);
    }
}
