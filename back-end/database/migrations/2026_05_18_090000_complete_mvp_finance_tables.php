<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('budget_categories', function (Blueprint $table) {
            $table->foreignId('user_id')->after('id')->constrained()->cascadeOnDelete();
            $table->string('name', 120)->after('user_id');
            $table->string('icon', 60)->nullable()->after('name');
            $table->string('color', 30)->nullable()->after('icon');
            $table->boolean('is_active')->default(true)->after('color');

            $table->index(['user_id', 'is_active']);
        });

        Schema::table('budgets', function (Blueprint $table) {
            $table->foreignId('user_id')->after('id')->constrained()->cascadeOnDelete();
            $table->foreignId('budget_category_id')
                ->after('user_id')
                ->constrained()
                ->cascadeOnDelete();
            $table->unsignedSmallInteger('period_year')->after('budget_category_id');
            $table->unsignedTinyInteger('period_month')->after('period_year');
            $table->decimal('amount', 15, 2)->default(0)->after('period_month');

            $table->unique(
                ['user_id', 'budget_category_id', 'period_year', 'period_month'],
                'budgets_user_category_period_unique'
            );
        });

        Schema::table('transactions', function (Blueprint $table) {
            $table->foreignId('user_id')->after('id')->constrained()->cascadeOnDelete();
            $table->enum('type', ['income', 'expense', 'transfer'])->after('user_id');
            $table->foreignId('wallet_id')
                ->after('type')
                ->constrained()
                ->cascadeOnDelete();
            $table->foreignId('to_wallet_id')
                ->nullable()
                ->after('wallet_id')
                ->constrained('wallets')
                ->nullOnDelete();
            $table->foreignId('budget_category_id')
                ->nullable()
                ->after('to_wallet_id')
                ->constrained()
                ->nullOnDelete();
            $table->decimal('amount', 15, 2)->after('budget_category_id');
            $table->date('trx_date')->after('amount');
            $table->text('note')->nullable()->after('trx_date');
            $table->enum('status', ['completed', 'cancelled'])->default('completed')->after('note');

            $table->index(['user_id', 'trx_date']);
            $table->index(['user_id', 'type']);
        });

        Schema::table('transaction_attachments', function (Blueprint $table) {
            $table->foreignId('transaction_id')
                ->after('id')
                ->constrained()
                ->cascadeOnDelete();
            $table->string('file_path')->after('transaction_id');
            $table->string('caption')->nullable()->after('file_path');
            $table->unsignedSmallInteger('sort_order')->default(0)->after('caption');

            $table->index(['transaction_id', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::table('transaction_attachments', function (Blueprint $table) {
            $table->dropIndex(['transaction_id', 'sort_order']);
            $table->dropConstrainedForeignId('transaction_id');
            $table->dropColumn(['file_path', 'caption', 'sort_order']);
        });

        Schema::table('transactions', function (Blueprint $table) {
            $table->dropIndex(['user_id', 'trx_date']);
            $table->dropIndex(['user_id', 'type']);
            $table->dropConstrainedForeignId('budget_category_id');
            $table->dropConstrainedForeignId('to_wallet_id');
            $table->dropConstrainedForeignId('wallet_id');
            $table->dropConstrainedForeignId('user_id');
            $table->dropColumn(['type', 'amount', 'trx_date', 'note', 'status']);
        });

        Schema::table('budgets', function (Blueprint $table) {
            $table->dropUnique('budgets_user_category_period_unique');
            $table->dropConstrainedForeignId('budget_category_id');
            $table->dropConstrainedForeignId('user_id');
            $table->dropColumn(['period_year', 'period_month', 'amount']);
        });

        Schema::table('budget_categories', function (Blueprint $table) {
            $table->dropIndex(['user_id', 'is_active']);
            $table->dropConstrainedForeignId('user_id');
            $table->dropColumn(['name', 'icon', 'color', 'is_active']);
        });
    }
};
