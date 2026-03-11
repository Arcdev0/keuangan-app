<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Wallet;
use Illuminate\Http\Request;

class WalletController extends Controller
{
    public function index(Request $request)
    {
        $wallets = $request->user()
            ->wallets()
            ->latest('id')
            ->get();

        return response()->json([
            'data' => $wallets,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'type' => ['required', 'string', 'in:cash,bank,e-wallet,other'],
            'opening_balance' => ['required', 'numeric', 'min:0'],
        ]);

        $user = $request->user();
        $isFirstWallet = ! $user->wallets()->exists();

        $wallet = Wallet::create([
            'user_id' => $user->id,
            'name' => $validated['name'],
            'type' => $validated['type'],
            'opening_balance' => $validated['opening_balance'],
            'current_balance' => $validated['opening_balance'],
            'is_default' => $isFirstWallet,
            'is_active' => true,
        ]);

        if (! $user->has_wallet_setup) {
            $user->forceFill(['has_wallet_setup' => true])->save();
        }

        return response()->json([
            'message' => 'Dompet berhasil dibuat',
            'data' => $wallet,
        ], 201);
    }
}
