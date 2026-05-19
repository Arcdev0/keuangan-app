<?php

namespace Tests\Feature;

use App\Models\Budget;
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

    public function test_budget_summary_allows_negative_remaining_when_over_limit(): void
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
            'current_balance' => 350000,
            'is_default' => true,
            'is_active' => true,
        ]);

        Budget::create([
            'user_id' => $user->id,
            'budget_category_id' => $category->id,
            'period_year' => 2026,
            'period_month' => 5,
            'amount' => 100000,
        ]);
        Transaction::create([
            'user_id' => $user->id,
            'type' => 'expense',
            'wallet_id' => $wallet->id,
            'budget_category_id' => $category->id,
            'amount' => 150000,
            'trx_date' => '2026-05-19',
            'status' => 'completed',
        ]);

        Sanctum::actingAs($user);

        $response = $this->getJson('/api/budgets?year=2026&month=5');

        $response
            ->assertOk()
            ->assertJsonPath('data.total_remaining', -50000);

        $item = collect($response->json('data.items'))
            ->firstWhere('category_id', $category->id);

        $this->assertSame(-50000, $item['remaining']);
        $this->assertSame(150, $item['percentage']);
    }

    public function test_user_can_create_budget_category(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/budget-categories', [
            'name' => 'Kesehatan',
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('data.name', 'Kesehatan');

        $this->assertDatabaseHas('budget_categories', [
            'user_id' => $user->id,
            'name' => 'Kesehatan',
            'is_active' => true,
        ]);
    }

    public function test_user_can_delete_budget_category_and_move_transactions_to_lainnya(): void
    {
        $user = User::factory()->create();
        $category = BudgetCategory::create([
            'user_id' => $user->id,
            'name' => 'Kopi',
            'is_active' => true,
        ]);
        $fallback = BudgetCategory::create([
            'user_id' => $user->id,
            'name' => 'Lainnya',
            'is_active' => true,
        ]);
        $wallet = Wallet::create([
            'user_id' => $user->id,
            'name' => 'Tunai',
            'type' => 'cash',
            'opening_balance' => 500000,
            'current_balance' => 450000,
            'is_default' => true,
            'is_active' => true,
        ]);
        $transaction = Transaction::create([
            'user_id' => $user->id,
            'type' => 'expense',
            'wallet_id' => $wallet->id,
            'budget_category_id' => $category->id,
            'amount' => 50000,
            'trx_date' => '2026-05-19',
            'status' => 'completed',
        ]);
        Budget::create([
            'user_id' => $user->id,
            'budget_category_id' => $category->id,
            'period_year' => 2026,
            'period_month' => 5,
            'amount' => 100000,
        ]);

        Sanctum::actingAs($user);

        $this->deleteJson("/api/budget-categories/{$category->id}")
            ->assertOk()
            ->assertJsonPath('message', 'Kategori berhasil dihapus. Transaksi lama dipindahkan ke Lainnya.');

        $this->assertFalse($category->fresh()->is_active);
        $this->assertSame($fallback->id, $transaction->fresh()->budget_category_id);
        $this->assertDatabaseMissing('budgets', [
            'user_id' => $user->id,
            'budget_category_id' => $category->id,
        ]);
    }

    public function test_user_can_delete_budget_limit_without_deleting_category(): void
    {
        $user = User::factory()->create();
        $category = BudgetCategory::create([
            'user_id' => $user->id,
            'name' => 'Transportasi',
            'is_active' => true,
        ]);
        $budget = Budget::create([
            'user_id' => $user->id,
            'budget_category_id' => $category->id,
            'period_year' => 2026,
            'period_month' => 5,
            'amount' => 300000,
        ]);

        Sanctum::actingAs($user);

        $this->deleteJson("/api/budgets/{$budget->id}")
            ->assertOk()
            ->assertJsonPath('message', 'Limit anggaran berhasil dihapus');

        $this->assertDatabaseMissing('budgets', ['id' => $budget->id]);
        $this->assertDatabaseHas('budget_categories', ['id' => $category->id]);
    }

    public function test_user_can_copy_previous_month_budget_limits(): void
    {
        $user = User::factory()->create();
        $category = BudgetCategory::create([
            'user_id' => $user->id,
            'name' => 'Makanan',
            'is_active' => true,
        ]);
        Budget::create([
            'user_id' => $user->id,
            'budget_category_id' => $category->id,
            'period_year' => 2026,
            'period_month' => 4,
            'amount' => 750000,
        ]);

        Sanctum::actingAs($user);

        $response = $this->postJson('/api/budgets/copy-previous', [
            'period_year' => 2026,
            'period_month' => 5,
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('data.total_limit', 750000);

        $this->assertDatabaseHas('budgets', [
            'user_id' => $user->id,
            'budget_category_id' => $category->id,
            'period_year' => 2026,
            'period_month' => 5,
            'amount' => 750000,
        ]);
    }
}
