<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Transaction;
use App\Models\Wallet;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class TransactionController extends Controller
{
    public function index(Request $request)
    {
        $validated = $request->validate([
            'type' => ['nullable', Rule::in(['income', 'expense', 'transfer'])],
            'wallet_id' => ['nullable', 'integer'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date', 'after_or_equal:start_date'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $transactions = $request->user()
            ->transactions()
            ->with(['wallet', 'toWallet', 'category', 'attachments'])
            ->when($validated['type'] ?? null, fn ($query, $type) => $query->where('type', $type))
            ->when($validated['wallet_id'] ?? null, function ($query, $walletId) {
                $query->where(function ($nestedQuery) use ($walletId) {
                    $nestedQuery
                        ->where('wallet_id', $walletId)
                        ->orWhere('to_wallet_id', $walletId);
                });
            })
            ->when($validated['start_date'] ?? null, fn ($query, $date) => $query->whereDate('trx_date', '>=', $date))
            ->when($validated['end_date'] ?? null, fn ($query, $date) => $query->whereDate('trx_date', '<=', $date))
            ->latest('trx_date')
            ->latest('id')
            ->paginate($validated['per_page'] ?? 20);

        return response()->json($transactions);
    }

    public function store(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'type' => ['required', Rule::in(['income', 'expense', 'transfer'])],
            'wallet_id' => [
                'required',
                Rule::exists('wallets', 'id')->where(fn ($query) => $query
                    ->where('user_id', $user->id)
                    ->where('is_active', true)),
            ],
            'to_wallet_id' => [
                'required_if:type,transfer',
                'nullable',
                'different:wallet_id',
                Rule::exists('wallets', 'id')->where(fn ($query) => $query
                    ->where('user_id', $user->id)
                    ->where('is_active', true)),
            ],
            'budget_category_id' => [
                'required_if:type,expense',
                'nullable',
                Rule::exists('budget_categories', 'id')->where(fn ($query) => $query
                    ->where('user_id', $user->id)
                    ->where('is_active', true)),
            ],
            'amount' => ['required', 'numeric', 'gt:0'],
            'trx_date' => ['required', 'date'],
            'note' => ['nullable', 'string', 'max:1000'],
            'attachment' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:5120'],
        ]);

        $transaction = DB::transaction(function () use ($request, $user, $validated) {
            $wallet = Wallet::where('user_id', $user->id)
                ->where('is_active', true)
                ->lockForUpdate()
                ->findOrFail($validated['wallet_id']);

            $amount = (float) $validated['amount'];
            $toWallet = null;

            if ($validated['type'] === 'expense') {
                $this->ensureSufficientBalance($wallet, $amount);
                $wallet->decrement('current_balance', $amount);
            }

            if ($validated['type'] === 'income') {
                $wallet->increment('current_balance', $amount);
            }

            if ($validated['type'] === 'transfer') {
                $this->ensureSufficientBalance($wallet, $amount);

                $toWallet = Wallet::where('user_id', $user->id)
                    ->where('is_active', true)
                    ->lockForUpdate()
                    ->findOrFail($validated['to_wallet_id']);

                $wallet->decrement('current_balance', $amount);
                $toWallet->increment('current_balance', $amount);
            }

            $transaction = Transaction::create([
                'user_id' => $user->id,
                'type' => $validated['type'],
                'wallet_id' => $wallet->id,
                'to_wallet_id' => $toWallet?->id,
                'budget_category_id' => $validated['budget_category_id'] ?? null,
                'amount' => $amount,
                'trx_date' => $validated['trx_date'],
                'note' => $validated['note'] ?? null,
                'status' => 'completed',
            ]);

            if ($request->hasFile('attachment')) {
                $path = $request->file('attachment')->store('transaction-attachments', 'public');

                $transaction->attachments()->create([
                    'file_path' => Storage::url($path),
                    'caption' => $request->file('attachment')->getClientOriginalName(),
                    'sort_order' => 0,
                ]);
            }

            return $transaction->load(['wallet', 'toWallet', 'category', 'attachments']);
        });

        return response()->json([
            'message' => 'Transaksi berhasil disimpan',
            'data' => $transaction,
        ], 201);
    }

    public function show(Request $request, Transaction $transaction)
    {
        if ($transaction->user_id !== $request->user()->id) {
            abort(404);
        }

        return response()->json([
            'data' => $transaction->load(['wallet', 'toWallet', 'category', 'attachments']),
        ]);
    }

    private function ensureSufficientBalance(Wallet $wallet, float $amount): void
    {
        if ((float) $wallet->current_balance < $amount) {
            throw ValidationException::withMessages([
                'amount' => ['Saldo dompet tidak mencukupi.'],
            ]);
        }
    }
}
