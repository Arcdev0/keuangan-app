<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BudgetController;
use App\Http\Controllers\Api\BudgetCategoryController;
use App\Http\Controllers\Api\TransactionController;
use App\Http\Controllers\Api\WalletController;
use Illuminate\Support\Facades\Route;

Route::middleware('throttle:5,1')->group(function () {
    Route::post('/login',    [AuthController::class, 'login']);
});

Route::middleware('throttle:3,1')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
});

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me',      [AuthController::class, 'me']);
    Route::post('/change-password', [AuthController::class, 'updatePassword']);

    Route::get('/wallets',  [WalletController::class, 'index']);
    Route::post('/wallets', [WalletController::class, 'store']);

    Route::get('/budget-categories', [BudgetCategoryController::class, 'index']);
    Route::post('/budget-categories', [BudgetCategoryController::class, 'store']);
    Route::delete('/budget-categories/{budgetCategory}', [BudgetCategoryController::class, 'destroy']);
    Route::get('/budgets', [BudgetController::class, 'index']);
    Route::post('/budgets', [BudgetController::class, 'store']);
    Route::post('/budgets/copy-previous', [BudgetController::class, 'copyPrevious']);
    Route::delete('/budgets/{budget}', [BudgetController::class, 'destroy']);

    Route::get('/transactions', [TransactionController::class, 'index']);
    Route::post('/transactions/scan-receipt', [TransactionController::class, 'scanReceipt'])
        ->middleware('throttle:6,1');
    Route::post('/transactions', [TransactionController::class, 'store']);
    Route::get('/transactions/{transaction}', [TransactionController::class, 'show']);
    Route::match(['put', 'patch', 'post'], '/transactions/{transaction}', [TransactionController::class, 'update']);
    Route::delete('/transactions/{transaction}', [TransactionController::class, 'destroy']);
});
