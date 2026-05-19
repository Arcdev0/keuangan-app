<?php

namespace Tests\Feature;

use App\Models\BudgetCategory;
use App\Models\User;
use App\Models\Wallet;
use App\Services\ReceiptOcrService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TransactionControllerTest extends TestCase
{
    use RefreshDatabase;

    private function createCategory(User $user, string $name = 'Makanan'): BudgetCategory
    {
        return BudgetCategory::create([
            'user_id' => $user->id,
            'name' => $name,
            'is_active' => true,
        ]);
    }

    public function test_income_transaction_increases_wallet_balance(): void
    {
        $user = User::factory()->create();
        $wallet = Wallet::create([
            'user_id' => $user->id,
            'name' => 'Tunai',
            'type' => 'cash',
            'opening_balance' => 100000,
            'current_balance' => 100000,
            'is_default' => true,
            'is_active' => true,
        ]);

        Sanctum::actingAs($user);

        $response = $this->postJson('/api/transactions', [
            'type' => 'income',
            'wallet_id' => $wallet->id,
            'amount' => 50000,
            'trx_date' => '2026-05-18',
            'note' => 'Gaji harian',
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('data.type', 'income');

        $this->assertSame('150000.00', $wallet->fresh()->current_balance);
    }

    public function test_expense_transaction_decreases_wallet_balance(): void
    {
        $user = User::factory()->create();
        $category = $this->createCategory($user);
        $wallet = Wallet::create([
            'user_id' => $user->id,
            'name' => 'Tunai',
            'type' => 'cash',
            'opening_balance' => 100000,
            'current_balance' => 100000,
            'is_default' => true,
            'is_active' => true,
        ]);

        Sanctum::actingAs($user);

        $response = $this->postJson('/api/transactions', [
            'type' => 'expense',
            'wallet_id' => $wallet->id,
            'budget_category_id' => $category->id,
            'amount' => 25000,
            'trx_date' => '2026-05-18',
            'note' => 'Makan siang',
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('data.type', 'expense');

        $this->assertSame('75000.00', $wallet->fresh()->current_balance);
    }

    public function test_transfer_transaction_moves_balance_between_wallets(): void
    {
        $user = User::factory()->create();
        $cashWallet = Wallet::create([
            'user_id' => $user->id,
            'name' => 'Tunai',
            'type' => 'cash',
            'opening_balance' => 100000,
            'current_balance' => 100000,
            'is_default' => true,
            'is_active' => true,
        ]);
        $bankWallet = Wallet::create([
            'user_id' => $user->id,
            'name' => 'Bank',
            'type' => 'bank',
            'opening_balance' => 50000,
            'current_balance' => 50000,
            'is_default' => false,
            'is_active' => true,
        ]);

        Sanctum::actingAs($user);

        $response = $this->postJson('/api/transactions', [
            'type' => 'transfer',
            'wallet_id' => $cashWallet->id,
            'to_wallet_id' => $bankWallet->id,
            'amount' => 30000,
            'trx_date' => '2026-05-18',
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('data.type', 'transfer');

        $this->assertSame('70000.00', $cashWallet->fresh()->current_balance);
        $this->assertSame('80000.00', $bankWallet->fresh()->current_balance);
    }

    public function test_expense_transaction_rejects_insufficient_balance(): void
    {
        $user = User::factory()->create();
        $category = $this->createCategory($user);
        $wallet = Wallet::create([
            'user_id' => $user->id,
            'name' => 'Tunai',
            'type' => 'cash',
            'opening_balance' => 10000,
            'current_balance' => 10000,
            'is_default' => true,
            'is_active' => true,
        ]);

        Sanctum::actingAs($user);

        $response = $this->postJson('/api/transactions', [
            'type' => 'expense',
            'wallet_id' => $wallet->id,
            'budget_category_id' => $category->id,
            'amount' => 25000,
            'trx_date' => '2026-05-18',
        ]);

        $response
            ->assertUnprocessable()
            ->assertJsonValidationErrors('amount');

        $this->assertSame('10000.00', $wallet->fresh()->current_balance);
    }

    public function test_expense_transaction_requires_a_category(): void
    {
        $user = User::factory()->create();
        $wallet = Wallet::create([
            'user_id' => $user->id,
            'name' => 'Tunai',
            'type' => 'cash',
            'opening_balance' => 100000,
            'current_balance' => 100000,
            'is_default' => true,
            'is_active' => true,
        ]);

        Sanctum::actingAs($user);

        $response = $this->postJson('/api/transactions', [
            'type' => 'expense',
            'wallet_id' => $wallet->id,
            'amount' => 25000,
            'trx_date' => '2026-05-18',
        ]);

        $response
            ->assertUnprocessable()
            ->assertJsonValidationErrors('budget_category_id');

        $this->assertSame('100000.00', $wallet->fresh()->current_balance);
    }

    public function test_transaction_can_store_an_attachment(): void
    {
        Storage::fake('public');

        $user = User::factory()->create();
        $category = $this->createCategory($user);
        $wallet = Wallet::create([
            'user_id' => $user->id,
            'name' => 'Tunai',
            'type' => 'cash',
            'opening_balance' => 100000,
            'current_balance' => 100000,
            'is_default' => true,
            'is_active' => true,
        ]);

        Sanctum::actingAs($user);

        $response = $this->post('/api/transactions', [
            'type' => 'expense',
            'wallet_id' => $wallet->id,
            'budget_category_id' => $category->id,
            'amount' => 15000,
            'trx_date' => '2026-05-18',
            'attachment' => UploadedFile::fake()->image('struk.jpg'),
        ]);

        $response
            ->assertCreated()
            ->assertJsonCount(1, 'data.attachments');

        $this->assertNotEmpty(Storage::disk('public')->files('transaction-attachments'));
    }

    public function test_receipt_scan_returns_parsed_transaction_suggestion(): void
    {
        Storage::fake('local');

        $user = User::factory()->create();
        $category = $this->createCategory($user);

        $this->mock(ReceiptOcrService::class, function ($mock) use ($category) {
            $mock->shouldReceive('scan')
                ->once()
                ->andReturn([
                    'raw_text' => 'TOTAL Rp15.000',
                    'parsed' => [
                        'amount' => 15000,
                        'trx_date' => '2026-05-19',
                        'note' => 'Warung - Struk belanja',
                        'merchant' => 'Warung',
                        'budget_category_id' => $category->id,
                        'category_name' => $category->name,
                    ],
                    'confidence_note' => 'Hasil OCR perlu dicek ulang sebelum transaksi disimpan.',
                ]);
        });

        Sanctum::actingAs($user);

        $response = $this->post('/api/transactions/scan-receipt', [
            'receipt' => UploadedFile::fake()->image('struk.jpg'),
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('data.parsed.amount', 15000)
            ->assertJsonPath('data.parsed.budget_category_id', $category->id);
    }

    public function test_transaction_can_be_updated_and_recalculates_wallet_balance(): void
    {
        $user = User::factory()->create();
        $category = $this->createCategory($user);
        $wallet = Wallet::create([
            'user_id' => $user->id,
            'name' => 'Tunai',
            'type' => 'cash',
            'opening_balance' => 100000,
            'current_balance' => 100000,
            'is_default' => true,
            'is_active' => true,
        ]);

        Sanctum::actingAs($user);

        $created = $this->postJson('/api/transactions', [
            'type' => 'expense',
            'wallet_id' => $wallet->id,
            'budget_category_id' => $category->id,
            'amount' => 25000,
            'trx_date' => '2026-05-18',
            'note' => 'Typo',
        ])->json('data');

        $response = $this->patchJson("/api/transactions/{$created['id']}", [
            'type' => 'expense',
            'wallet_id' => $wallet->id,
            'budget_category_id' => $category->id,
            'amount' => 15000,
            'trx_date' => '2026-05-18',
            'note' => 'Makan siang',
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('data.amount', '15000.00');

        $this->assertSame('85000.00', $wallet->fresh()->current_balance);
    }

    public function test_transaction_can_be_deleted_and_reverses_wallet_balance(): void
    {
        $user = User::factory()->create();
        $category = $this->createCategory($user);
        $wallet = Wallet::create([
            'user_id' => $user->id,
            'name' => 'Tunai',
            'type' => 'cash',
            'opening_balance' => 100000,
            'current_balance' => 100000,
            'is_default' => true,
            'is_active' => true,
        ]);

        Sanctum::actingAs($user);

        $created = $this->postJson('/api/transactions', [
            'type' => 'expense',
            'wallet_id' => $wallet->id,
            'budget_category_id' => $category->id,
            'amount' => 25000,
            'trx_date' => '2026-05-18',
        ])->json('data');

        $this->assertSame('75000.00', $wallet->fresh()->current_balance);

        $this->deleteJson("/api/transactions/{$created['id']}")
            ->assertOk()
            ->assertJsonPath('message', 'Transaksi berhasil dihapus');

        $this->assertSame('100000.00', $wallet->fresh()->current_balance);
        $this->assertDatabaseMissing('transactions', ['id' => $created['id']]);
    }
}
