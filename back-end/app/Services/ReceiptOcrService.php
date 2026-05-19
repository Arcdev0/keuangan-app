<?php

namespace App\Services;

use App\Models\BudgetCategory;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\Process\Exception\ProcessFailedException;
use Symfony\Component\Process\Exception\ProcessTimedOutException;
use Symfony\Component\Process\Process;

class ReceiptOcrService
{
    public function scan(UploadedFile $file, User $user): array
    {
        $path = $file->store('receipt-scans', 'local');
        $absolutePath = Storage::disk('local')->path($path);

        try {
            $rawText = $this->readText($absolutePath);
            $parsed = $this->parseReceiptText($rawText, $user);

            return [
                'raw_text' => $rawText,
                'parsed' => $parsed,
                'confidence_note' => 'Hasil OCR perlu dicek ulang sebelum transaksi disimpan.',
            ];
        } finally {
            Storage::disk('local')->delete($path);
        }
    }

    private function readText(string $absolutePath): string
    {
        $process = new Process([
            config('ocr.tesseract_path'),
            $absolutePath,
            'stdout',
            '-l',
            config('ocr.language'),
            '--psm',
            '6',
        ]);

        $process->setTimeout(30);

        try {
            $process->mustRun();
        } catch (ProcessTimedOutException) {
            throw ValidationException::withMessages([
                'receipt' => ['OCR terlalu lama membaca struk. Coba foto yang lebih jelas.'],
            ]);
        } catch (ProcessFailedException) {
            throw ValidationException::withMessages([
                'receipt' => ['Tesseract OCR belum siap atau gagal membaca gambar. Pastikan Tesseract sudah terinstall.'],
            ]);
        }

        $text = trim($process->getOutput());

        if ($text === '') {
            throw ValidationException::withMessages([
                'receipt' => ['Teks struk tidak terbaca. Coba foto yang lebih terang dan tidak blur.'],
            ]);
        }

        return $text;
    }

    private function parseReceiptText(string $text, User $user): array
    {
        $lines = collect(preg_split('/\r\n|\r|\n/', $text))
            ->map(fn ($line) => trim(preg_replace('/\s+/', ' ', $line)))
            ->filter()
            ->values();

        $amount = $this->extractAmount($lines->all());
        $date = $this->extractDate($text);
        $details = $this->extractReceiptDetails($lines->all());
        $merchant = $details['merchant'] ?? $this->extractMerchant($lines->all());
        $category = $this->guessCategory($text, $user);

        return [
            'amount' => $amount,
            'trx_date' => $date,
            'note' => $this->buildReceiptNote($lines->all(), $merchant, $details),
            'merchant' => $merchant,
            'budget_category_id' => $category?->id,
            'category_name' => $category?->name,
        ];
    }

    private function extractAmount(array $lines): ?int
    {
        $livinAmount = $this->extractLivinAmount($lines);

        if ($livinAmount !== null) {
            return $livinAmount;
        }

        $totalCandidates = $this->findTotalAmountCandidates($lines);

        if ($totalCandidates !== []) {
            usort($totalCandidates, fn ($a, $b) => [$b['score'], $b['index']] <=> [$a['score'], $a['index']]);

            return $totalCandidates[0]['value'];
        }

        $candidates = [];

        foreach ($lines as $index => $line) {
            if ($this->isMetadataLine($line)) {
                continue;
            }

            foreach ($this->extractAmountsFromLine($line) as $amount) {
                if ($this->isPlausibleReceiptAmount($amount)) {
                    $candidates[] = [
                        'value' => $amount,
                        'score' => str_contains(Str::lower($line), 'rp') ? 2 : 1,
                        'index' => $index,
                    ];
                }
            }
        }

        if ($candidates === []) {
            return null;
        }

        usort($candidates, fn ($a, $b) => [$b['score'], $b['index'], $b['value']] <=> [$a['score'], $a['index'], $a['value']]);

        return $candidates[0]['value'];
    }

    private function extractLivinAmount(array $lines): ?int
    {
        $joinedText = Str::lower(implode(' ', $lines));

        if (! Str::contains($joinedText, ['livin', 'nominal transfer', 'transfer berhasil'])) {
            return null;
        }

        $total = $this->firstAmountNearLabel($lines, ['total transaksi']);

        if ($total !== null && $total >= 100000) {
            return $total;
        }

        $nominal = $this->firstAmountNearLabel($lines, ['nominal transfer']);
        $fee = $this->firstAmountNearLabel($lines, ['biaya transaksi']);

        if ($nominal !== null && $nominal >= 100000) {
            return $nominal + ($fee ?? 0);
        }

        return $total;
    }

    private function firstAmountNearLabel(array $lines, array $labels): ?int
    {
        foreach ($lines as $index => $line) {
            $normalizedLine = $this->normalizeOcrLabel($line);

            if (! Str::contains($normalizedLine, $labels)) {
                continue;
            }

            foreach (array_slice($lines, $index, 3) as $candidateLine) {
                foreach ($this->extractAmountsFromLine($candidateLine) as $amount) {
                    if ($this->isPlausibleReceiptAmount($amount)) {
                        return $amount;
                    }
                }
            }
        }

        return null;
    }

    private function findTotalAmountCandidates(array $lines): array
    {
        $candidates = [];

        foreach ($lines as $index => $line) {
            if (! $this->isTotalLine($line)) {
                continue;
            }

            foreach ($this->extractAmountsFromLine($line) as $amount) {
                if ($this->isPlausibleReceiptAmount($amount)) {
                    $candidates[] = [
                        'value' => $amount,
                        'score' => $this->scoreTotalLine($line),
                        'index' => $index,
                    ];
                }
            }

            if ($candidates !== []) {
                continue;
            }

            foreach (array_slice($lines, $index + 1, 2, true) as $nextIndex => $nextLine) {
                if ($this->isMetadataLine($nextLine) || $this->isPaymentLine($nextLine)) {
                    continue;
                }

                foreach ($this->extractAmountsFromLine($nextLine) as $amount) {
                    if ($this->isPlausibleReceiptAmount($amount)) {
                        $candidates[] = [
                            'value' => $amount,
                            'score' => $this->scoreTotalLine($line) - (($nextIndex - $index) * 5),
                            'index' => $nextIndex,
                        ];
                    }
                }
            }
        }

        return $candidates;
    }

    private function extractAmountsFromLine(string $line): array
    {
        preg_match_all('/(?:rp\.?\s*)?(\d{1,3}(?:[\s.,]\d{3})+(?:[.,]\d{2})?|\d{4,8}(?:[.,]\d{2})?)/i', $line, $matches);

        return collect($matches[1] ?? [])
            ->map(fn ($match) => $this->normalizeAmount($match))
            ->filter(fn ($amount) => $amount !== null)
            ->values()
            ->all();
    }

    private function normalizeAmount(string $value): ?int
    {
        $value = preg_replace('/\s+/', '', $value);

        if (preg_match('/[.,]\d{2}$/', $value)) {
            $value = substr($value, 0, -3);
        }

        $amount = (int) preg_replace('/\D/', '', $value);

        return $amount > 0 ? $amount : null;
    }

    private function isTotalLine(string $line): bool
    {
        $lowerLine = Str::lower($line);

        if (Str::contains($lowerLine, ['subtotal', 'sub total', 'diskon', 'discount', 'pajak', 'tax', 'kembali', 'kembalian', 'change'])) {
            return false;
        }

        return Str::contains($lowerLine, [
            'grand total',
            'total payment',
            'total transaksi',
            'total tagihan',
            'total bayar',
            'total belanja',
            'total pembayaran',
            'nominal transfer',
            'amount due',
            'jumlah bayar',
            'total',
        ]);
    }

    private function scoreTotalLine(string $line): int
    {
        $lowerLine = Str::lower($line);

        if (Str::contains($lowerLine, ['grand total', 'total payment', 'total transaksi', 'total tagihan', 'total bayar', 'total belanja', 'total pembayaran', 'amount due'])) {
            return 80;
        }

        if (Str::contains($lowerLine, ['nominal transfer', 'jumlah bayar', 'total'])) {
            return 70;
        }

        return 60;
    }

    private function isMetadataLine(string $line): bool
    {
        $lowerLine = Str::lower($line);

        if ($this->isTotalLine($line)) {
            return false;
        }

        return Str::contains($lowerLine, [
            'tanggal',
            'date',
            'jam',
            'time',
            'telp',
            'phone',
            'npwp',
            'invoice',
            'order',
            'no.',
            'no ',
            'nota',
            'struk',
            'receipt',
            'rrn',
            'ref',
            'transaction id',
            'merchant order id',
            'metode transfer',
            'no referensi',
            'penerima',
            'rekening sumber',
            'terminal id',
            'merchant pan',
            'customer pan',
            'member',
            'card',
            'auth',
            'kasir',
            'cashier',
            'tunai',
            'cash',
            'debit',
            'kartu',
            'dibayar',
        ]);
    }

    private function isPaymentLine(string $line): bool
    {
        $lowerLine = Str::lower($line);

        return Str::contains($lowerLine, ['tunai', 'cash', 'debit', 'kredit', 'kartu', 'kembali', 'kembalian', 'change']);
    }

    private function isPlausibleReceiptAmount(int $amount): bool
    {
        return $amount >= 100 && $amount <= 100000000;
    }

    private function extractDate(string $text): string
    {
        $patterns = [
            '/\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})\s*-\s*\d{1,2}:\d{2}:\d{2}\s*(?:wib|wit|wita)?\b/i',
            '/\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})\b/',
            '/\b(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})\b/',
            '/\b(\d{1,2})\s+(jan|januari|feb|februari|mar|maret|apr|april|mei|may|jun|juni|jul|juli|agu|agustus|aug|september|sep|okt|oct|oktober|nov|november|des|dec|desember)\s+(\d{4})\b/i',
        ];

        foreach ($patterns as $index => $pattern) {
            if (! preg_match($pattern, $text, $matches)) {
                continue;
            }

            try {
                if ($index <= 1) {
                    $year = strlen($matches[3]) === 2 ? '20'.$matches[3] : $matches[3];
                    return Carbon::createFromDate((int) $year, (int) $matches[2], (int) $matches[1])->toDateString();
                }

                if ($index === 2) {
                    return Carbon::createFromDate((int) $matches[1], (int) $matches[2], (int) $matches[3])->toDateString();
                }

                return Carbon::createFromDate((int) $matches[3], $this->monthNameToNumber($matches[2]), (int) $matches[1])->toDateString();
            } catch (\Throwable) {
                continue;
            }
        }

        return now()->toDateString();
    }

    private function extractMerchant(array $lines): ?string
    {
        foreach (array_slice($lines, 0, 5) as $line) {
            if (preg_match('/qr|qris|berhasil|total|tanggal|date|telp|phone|alamat|cashier|kasir/i', $line)) {
                continue;
            }

            return Str::limit($line, 60, '');
        }

        return null;
    }

    private function extractReceiptDetails(array $lines): array
    {
        $joinedText = Str::lower(implode(' ', $lines));

        if (Str::contains($joinedText, ['dana', 'total payment', 'transaction detail', 'google play'])) {
            return $this->extractDanaDetails($lines);
        }

        if (Str::contains($joinedText, ['livin', 'transfer berhasil', 'bi fast', 'nominal transfer'])) {
            return $this->extractLivinDetails($lines);
        }

        if (Str::contains($joinedText, ['m-transfer', 'm transfer', 'total tagihan', 'virtual account'])) {
            return $this->extractBcaTransferDetails($lines);
        }

        $isQris = Str::contains($joinedText, ['qris', 'merchant pan', 'customer pan', 'terminal id', 'pengakuisisi']);

        if (! $isQris) {
            return [];
        }

        $merchant = $this->extractLabelValue($lines, ['pembayaran ke']);
        $acquirer = $this->extractLabelValue($lines, ['pengakuisisi', 'acquirer']);
        $location = $this->extractLabelValue($lines, ['lokasi merchant']);
        $reference = $this->extractLabelValue($lines, ['ref']) ?? $this->extractLabelValue($lines, ['rrn']);

        return array_filter([
            'type' => 'qris',
            'merchant' => $merchant,
            'acquirer' => $acquirer,
            'location' => $location,
            'reference' => $reference,
        ]);
    }

    private function extractDanaDetails(array $lines): array
    {
        $merchant = $this->firstMeaningfulLine($lines, [
            'transaction detail',
            'transaction success',
            'transaction success!',
            'total payment',
            'price',
            'payment method',
            'this payment',
            'view details',
            'need some help',
            'dana',
        ]);
        $product = $this->lineAfterValue($lines, $merchant);
        $reference = $this->extractLongReference($lines, ['transaction id']);

        return array_filter([
            'type' => 'dana',
            'merchant' => $merchant,
            'product' => $product,
            'reference' => $reference,
        ]);
    }

    private function extractLivinDetails(array $lines): array
    {
        $recipient = $this->extractLabelValue($lines, ['penerima']);
        $method = $this->extractLivinMethod($lines);
        $reference = $this->extractLivinReference($lines);

        return array_filter([
            'type' => 'livin_transfer',
            'merchant' => $recipient,
            'method' => $method,
            'reference' => $reference,
        ]);
    }

    private function extractLivinMethod(array $lines): ?string
    {
        foreach ($lines as $line) {
            if (Str::contains($this->normalizeOcrLabel($line), ['bi fast', 'bifast'])) {
                return 'BI Fast';
            }
        }

        return $this->extractLabelValue($lines, ['metode transfer']);
    }

    private function extractBcaTransferDetails(array $lines): array
    {
        $merchant = $this->firstMeaningfulLine($lines, [
            'm-transfer',
            'm transfer',
            'berhasil',
            'total tagihan',
            'kirim ke',
            'biaya termasuk ppn',
            'pt bank central asia',
            'menara bca',
            'npwp',
        ]);
        $recipient = $this->extractInlineValue($lines, 'kirim ke');
        $reference = $this->firstLongNumericLine($lines);

        return array_filter([
            'type' => 'bca_transfer',
            'merchant' => $merchant,
            'recipient' => $recipient,
            'reference' => $reference,
        ]);
    }

    private function extractLabelValue(array $lines, array $labels): ?string
    {
        foreach ($lines as $index => $line) {
            $normalizedLine = $this->normalizeOcrLabel($line);

            foreach ($labels as $label) {
                $normalizedLabel = $this->normalizeOcrLabel($label);

                if (! str_starts_with($normalizedLine, $normalizedLabel)) {
                    continue;
                }

                $value = trim(substr($line, strlen($label)));
                $value = trim(preg_replace('/^[\s:=-]+/', '', $value));

                if ($value === '' || Str::lower($value) === $normalizedLabel) {
                    $value = $this->nextLikelyValue($lines, $index, $label);
                }

                return $this->cleanReceiptValue($value);
            }
        }

        return null;
    }

    private function extractInlineValue(array $lines, string $label): ?string
    {
        $normalizedLabel = $this->normalizeOcrLabel($label);

        foreach ($lines as $line) {
            $normalizedLine = $this->normalizeOcrLabel($line);

            if (! str_starts_with($normalizedLine, $normalizedLabel)) {
                continue;
            }

            return $this->cleanReceiptValue(trim(substr($line, strlen($label))));
        }

        return null;
    }

    private function extractLongReference(array $lines, array $labels): ?string
    {
        foreach ($lines as $index => $line) {
            $normalizedLine = $this->normalizeOcrLabel($line);

            foreach ($labels as $label) {
                if (! str_starts_with($normalizedLine, $this->normalizeOcrLabel($label))) {
                    continue;
                }

                $chunks = [$this->removeLabelPrefix($line, $label)];

                foreach (array_slice($lines, $index + 1, 4) as $nextLine) {
                    if ($this->looksLikeLabel($nextLine) || $this->isTotalLine($nextLine) || $this->isPaymentLine($nextLine)) {
                        break;
                    }

                    $chunks[] = $nextLine;
                }

                $reference = collect($chunks)
                    ->map(fn ($chunk) => preg_replace('/[^A-Za-z0-9]+/', '', $chunk ?? ''))
                    ->filter(fn ($chunk) => strlen($chunk) >= 8 && preg_match('/\d/', $chunk))
                    ->join('');

                return $reference !== '' ? Str::limit($reference, 80, '') : null;
            }
        }

        return null;
    }

    private function extractLivinReference(array $lines): ?string
    {
        foreach ($lines as $index => $line) {
            if (! Str::contains($this->normalizeOcrLabel($line), ['no referensi', 'no references', 'referensi'])) {
                continue;
            }

            $chunks = [];

            foreach (array_slice($lines, $index + 1, 5) as $nextLine) {
                if ($this->isTotalLine($nextLine) || $this->isPaymentLine($nextLine)) {
                    break;
                }

                $normalized = $this->normalizeOcrLabel($nextLine);

                if (Str::contains($normalized, ['biaya', 'tujuan transaksi', 'rekening sumber', 'penerima'])) {
                    break;
                }

                $chunk = preg_replace('/[^A-Za-z0-9]+/', '', $nextLine);

                if ($chunk === '' || Str::lower($chunk) === 'bifast') {
                    continue;
                }

                if (preg_match('/\d/', $chunk)) {
                    $chunks[] = $chunk;
                }
            }

            $reference = implode('', $chunks);

            return $reference !== '' ? Str::limit($reference, 80, '') : null;
        }

        return $this->extractLongReference($lines, ['no referensi']);
    }

    private function removeLabelPrefix(string $line, string $label): string
    {
        $labelPattern = collect(explode(' ', $this->normalizeOcrLabel($label)))
            ->filter()
            ->map(fn ($part) => preg_quote($part, '/'))
            ->join('[\s.:-]*');

        return trim(preg_replace('/^\s*'.$labelPattern.'\b[\s.:-]*/i', '', $line));
    }

    private function firstLongNumericLine(array $lines): ?string
    {
        foreach ($lines as $line) {
            if (preg_match('/\b(\d{12,})\b/', $line, $matches)) {
                return $matches[1];
            }
        }

        return null;
    }

    private function firstMeaningfulLine(array $lines, array $ignoredPhrases): ?string
    {
        foreach ($lines as $line) {
            $value = $this->cleanReceiptValue($line);

            if ($value === null) {
                continue;
            }

            $normalized = $this->normalizeOcrLabel($value);

            if (Str::contains($normalized, $ignoredPhrases)) {
                continue;
            }

            if (
                preg_match('/\b\d{1,2}\s+(jan|januari|feb|februari|mar|maret|apr|april|mei|may|jun|juni|jul|juli|agu|agustus|aug|sep|september|okt|oct|nov|des|dec)\b/i', $value) ||
                preg_match('/\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/', $value) ||
                preg_match('/rp\s*[\d.,]+/i', $value) ||
                preg_match('/^\d+$/', preg_replace('/\D/', '', $value))
            ) {
                continue;
            }

            return $value;
        }

        return null;
    }

    private function lineAfterValue(array $lines, ?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        foreach ($lines as $index => $line) {
            if ($this->normalizeOcrLabel($line) !== $this->normalizeOcrLabel($value)) {
                continue;
            }

            return $this->cleanReceiptValue($lines[$index + 1] ?? null);
        }

        return null;
    }

    private function nextLikelyValue(array $lines, int $index, ?string $label = null): ?string
    {
        $normalizedLabel = $label ? $this->normalizeOcrLabel($label) : null;

        foreach (array_slice($lines, $index + 1, 3) as $line) {
            if ($this->looksLikeLabel($line)) {
                continue;
            }

            if (
                $normalizedLabel &&
                Str::contains($normalizedLabel, ['penerima', 'pembayaran ke']) &&
                ! $this->looksLikePersonOrMerchant($line)
            ) {
                continue;
            }

            return $line;
        }

        return null;
    }

    private function looksLikePersonOrMerchant(string $line): bool
    {
        $cleanLine = trim($line);

        if ($cleanLine === '' || preg_match('/\d/', $cleanLine)) {
            return false;
        }

        if (Str::contains(Str::lower($cleanLine), ['bank ', 'rekening', 'transfer', 'bi fast', 'rupiah', 'berhasil'])) {
            return false;
        }

        return true;
    }

    private function buildReceiptNote(array $lines, ?string $merchant, array $details): string
    {
        if (($details['type'] ?? null) === 'qris') {
            return collect([
                'QRIS',
                $merchant,
                $details['acquirer'] ?? null,
                isset($details['reference']) ? 'Ref '.$details['reference'] : null,
            ])
                ->filter()
                ->join(' - ');
        }

        if (($details['type'] ?? null) === 'dana') {
            return collect([
                'DANA',
                $merchant,
                $details['product'] ?? null,
                isset($details['reference']) ? 'ID '.$details['reference'] : null,
            ])
                ->filter()
                ->join(' - ');
        }

        if (($details['type'] ?? null) === 'livin_transfer') {
            return collect([
                'Transfer',
                $details['method'] ?? null,
                $merchant,
                isset($details['reference']) ? 'Ref '.$details['reference'] : null,
            ])
                ->filter()
                ->join(' - ');
        }

        if (($details['type'] ?? null) === 'bca_transfer') {
            return collect([
                'm-Transfer',
                $merchant,
                isset($details['recipient']) ? 'ke '.$details['recipient'] : null,
                isset($details['reference']) ? 'Ref '.$details['reference'] : null,
            ])
                ->filter()
                ->join(' - ');
        }

        return trim(collect([$merchant, 'Struk belanja'])->filter()->join(' - '));
    }

    private function normalizeOcrLabel(string $value): string
    {
        return trim(preg_replace('/[^a-z0-9]+/', ' ', Str::lower($value)));
    }

    private function cleanReceiptValue(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $value = trim(preg_replace('/\s+/', ' ', $value));

        if ($value === '' || $this->looksLikeLabel($value)) {
            return null;
        }

        return Str::limit($value, 80, '');
    }

    private function looksLikeLabel(string $line): bool
    {
        return Str::contains($this->normalizeOcrLabel($line), [
            'pembayaran ke',
            'pengakuisisi',
            'lokasi merchant',
            'merchant pan',
            'terminal id',
            'customer pan',
            'rrn',
            'ref',
            'transaction id',
            'merchant order id',
            'penerima',
            'metode transfer',
            'no referensi',
            'rekening sumber',
            'kirim ke',
        ]);
    }

    private function monthNameToNumber(string $month): int
    {
        return [
            'jan' => 1,
            'januari' => 1,
            'feb' => 2,
            'februari' => 2,
            'mar' => 3,
            'maret' => 3,
            'apr' => 4,
            'april' => 4,
            'mei' => 5,
            'may' => 5,
            'jun' => 6,
            'juni' => 6,
            'jul' => 7,
            'juli' => 7,
            'agu' => 8,
            'agustus' => 8,
            'aug' => 8,
            'sep' => 9,
            'september' => 9,
            'okt' => 10,
            'oct' => 10,
            'oktober' => 10,
            'nov' => 11,
            'november' => 11,
            'des' => 12,
            'dec' => 12,
            'desember' => 12,
        ][Str::lower($month)] ?? 1;
    }

    private function guessCategory(string $text, User $user): ?BudgetCategory
    {
        $lowerText = Str::lower($text);
        $categories = $user->budgetCategories()->where('is_active', true)->get();

        foreach ($categories as $category) {
            if (str_contains($lowerText, Str::lower($category->name))) {
                return $category;
            }
        }

        $foodWords = ['makan', 'ayam', 'nasi', 'kopi', 'resto', 'restaurant', 'warung', 'cafe', 'bakso', 'mie'];
        $transportWords = ['parkir', 'bensin', 'tol', 'gojek', 'grab', 'transport'];

        if (Str::contains($lowerText, $foodWords)) {
            return $categories->first(fn ($category) => str_contains(Str::lower($category->name), 'makan'));
        }

        if (Str::contains($lowerText, $transportWords)) {
            return $categories->first(fn ($category) => str_contains(Str::lower($category->name), 'transport'));
        }

        return $categories->first(fn ($category) => str_contains(Str::lower($category->name), 'lain'));
    }
}
