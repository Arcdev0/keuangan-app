<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('wallets', function (Blueprint $table) {
            $table->foreignId('user_id')->nullable()->after('id')->constrained()->cascadeOnDelete();
            $table->string('name')->nullable()->after('user_id');
            $table->string('type')->default('cash')->after('name');
            $table->decimal('opening_balance', 15, 2)->default(0)->after('type');
            $table->decimal('current_balance', 15, 2)->default(0)->after('opening_balance');
            $table->boolean('is_default')->default(false)->after('current_balance');
            $table->boolean('is_active')->default(true)->after('is_default');
        });
    }

    public function down(): void
    {
        Schema::table('wallets', function (Blueprint $table) {
            $table->dropConstrainedForeignId('user_id');
            $table->dropColumn([
                'name',
                'type',
                'opening_balance',
                'current_balance',
                'is_default',
                'is_active',
            ]);
        });
    }
};
