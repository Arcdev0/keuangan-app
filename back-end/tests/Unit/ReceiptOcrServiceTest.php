<?php

namespace Tests\Unit;

use App\Services\ReceiptOcrService;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

class ReceiptOcrServiceTest extends TestCase
{
    public function test_extract_amount_prefers_total_over_receipt_metadata(): void
    {
        $amount = $this->extractAmount([
            'WARUNG MAKAN SEDAP',
            'NPWP 01.234.567.8-901.000',
            'Telp 021-12345678',
            'No Struk 202605191234',
            'Tanggal 19/05/2026 22:17',
            'Nasi Ayam Rp 12.000',
            'Es Teh Rp 3.000',
            'TOTAL BELANJA',
            'Rp 15.000',
            'TUNAI Rp 20.000',
            'KEMBALI Rp 5.000',
        ]);

        $this->assertSame(15000, $amount);
    }

    public function test_extract_amount_prefers_grand_total_over_subtotal(): void
    {
        $amount = $this->extractAmount([
            'Subtotal Rp 50.000',
            'Diskon Rp 5.000',
            'Grand Total Rp 45.000',
        ]);

        $this->assertSame(45000, $amount);
    }

    public function test_extract_amount_handles_decimal_currency_format(): void
    {
        $amount = $this->extractAmount([
            'TOTAL Rp 15.000,00',
        ]);

        $this->assertSame(15000, $amount);
    }

    public function test_qris_bca_receipt_extracts_amount_date_and_description(): void
    {
        $lines = [
            'QR',
            'Pembayaran QRIS Berhasil',
            'Rp185.293,00',
            '19/05/2026 - 03:24:58 WIB',
            'Pembayaran ke PT Tokopedia',
            'Pengakuisisi DOKU',
            'Lokasi Merchant Jakarta Selatan, 12190, ID',
            'Merchant PAN 936008990000594006',
            'Terminal ID A01',
            'Dari 8210****58',
            'Customer PAN 9360001410092641231',
            'RRN 483631310',
            'Ref 032410900361',
        ];

        $amount = $this->extractAmount($lines);
        $date = $this->invokePrivate('extractDate', [implode("\n", $lines)]);
        $details = $this->invokePrivate('extractReceiptDetails', [$lines]);
        $note = $this->invokePrivate('buildReceiptNote', [$lines, $details['merchant'], $details]);

        $this->assertSame(185293, $amount);
        $this->assertSame('2026-05-19', $date);
        $this->assertSame('PT Tokopedia', $details['merchant']);
        $this->assertSame('DOKU', $details['acquirer']);
        $this->assertSame('032410900361', $details['reference']);
        $this->assertSame('QRIS - PT Tokopedia - DOKU - Ref 032410900361', $note);
    }

    public function test_dana_google_receipt_extracts_description(): void
    {
        $lines = [
            'Transaction Detail',
            '07 May 2026 - 08:55',
            'DANA ID 0895****2918',
            'Transaction success!',
            'Google',
            'ChatGPT',
            'Total Payment Rp331.890',
            'Price Rp331.890',
            'Payment Method DANA Balance',
            'Transaction Detail',
            'Transaction ID 20260507111212800100',
            '166939159257153',
            'Merchant Order ID ... Qbpa',
        ];

        $amount = $this->extractAmount($lines);
        $date = $this->invokePrivate('extractDate', [implode("\n", $lines)]);
        $details = $this->invokePrivate('extractReceiptDetails', [$lines]);
        $note = $this->invokePrivate('buildReceiptNote', [$lines, $details['merchant'], $details]);

        $this->assertSame(331890, $amount);
        $this->assertSame('2026-05-07', $date);
        $this->assertSame('Google', $details['merchant']);
        $this->assertSame('ChatGPT', $details['product']);
        $this->assertSame('20260507111212800100166939159257153', $details['reference']);
        $this->assertSame('DANA - Google - ChatGPT - ID 20260507111212800100166939159257153', $note);
    }

    public function test_livin_transfer_receipt_extracts_description(): void
    {
        $lines = [
            'livin by mandiri',
            'Transfer Rupiah',
            'Transfer Berhasil!',
            '07 Mei 2026 - 08:46:48 WIB',
            'Penerima',
            'ILHAM NUR',
            'Bank Central Asia - 8210652958',
            'Nominal Transfer Rp 3.500.000',
            'Metode Transfer BI Fast',
            'No. Referensi',
            'BI Fast',
            '20260507BMRIIDJA0100',
            '0229494408',
            'Total Transaksi Rp 3.502.500',
        ];

        $amount = $this->extractAmount($lines);
        $date = $this->invokePrivate('extractDate', [implode("\n", $lines)]);
        $details = $this->invokePrivate('extractReceiptDetails', [$lines]);
        $note = $this->invokePrivate('buildReceiptNote', [$lines, $details['merchant'], $details]);

        $this->assertSame(3502500, $amount);
        $this->assertSame('2026-05-07', $date);
        $this->assertSame('ILHAM NUR', $details['merchant']);
        $this->assertSame('BI Fast', $details['method']);
        $this->assertSame('20260507BMRIIDJA01000229494408', $details['reference']);
        $this->assertSame('Transfer - BI Fast - ILHAM NUR - Ref 20260507BMRIIDJA01000229494408', $note);
    }

    public function test_livin_noisy_ocr_still_extracts_clean_amount_and_description(): void
    {
        $lines = [
            '08.46 all > 23)',
            'livin by mandiri',
            'Transfer Rupiah',
            'Transfer Berhasil!',
            '07 Mei 2026 - 08:46:48 WIB',
            'Penerima',
            'ILHAM NUR',
            'Bank Central Asia - 8210652958',
            'Detail Transaksi',
            'Nominal Transfer Rp 3.500.000',
            'Metode Transfer BI Fast',
            'No. Referensi',
            'BI Fast',
            '20260507BMRIIDJA0100',
            '0229494408',
            'Tujuan Transaksi Lainnya',
            'Biaya Transaksi Rp 2.500',
            'Total Transaksi Rp 3.502.500',
            'Biaya transaksi termasuk PPN',
        ];

        $amount = $this->extractAmount($lines);
        $details = $this->invokePrivate('extractReceiptDetails', [$lines]);
        $note = $this->invokePrivate('buildReceiptNote', [$lines, $details['merchant'], $details]);

        $this->assertSame(3502500, $amount);
        $this->assertSame('ILHAM NUR', $details['merchant']);
        $this->assertSame('20260507BMRIIDJA01000229494408', $details['reference']);
        $this->assertSame('Transfer - BI Fast - ILHAM NUR - Ref 20260507BMRIIDJA01000229494408', $note);
    }

    public function test_livin_uses_nominal_plus_fee_when_total_is_truncated(): void
    {
        $lines = [
            '08.46 all > 23)',
            'livin by mandiri',
            'Transfer Berhasil!',
            'Penerima',
            '08.46 all > 23)',
            'ILHAM NUR',
            'Nominal Transfer Rp 3.500.000',
            'Metode Transfer',
            '08.46 all > 23)',
            'BI Fast',
            'No. Referensi',
            'BI Fast',
            '0229404408',
            'Biaya Transaksi Rp 2.500',
            'Total Transaksi Rp 3.502',
        ];

        $amount = $this->extractAmount($lines);
        $details = $this->invokePrivate('extractReceiptDetails', [$lines]);
        $note = $this->invokePrivate('buildReceiptNote', [$lines, $details['merchant'], $details]);

        $this->assertSame(3502500, $amount);
        $this->assertSame('ILHAM NUR', $details['merchant']);
        $this->assertSame('BI Fast', $details['method']);
        $this->assertSame('Transfer - BI Fast - ILHAM NUR - Ref 0229404408', $note);
    }

    public function test_bca_m_transfer_receipt_extracts_description(): void
    {
        $lines = [
            'm-Transfer:',
            'BERHASIL',
            '09/05/2026 13:48:24',
            '1260895712608030',
            'SHOPEE',
            'dXXXXXXXXXXi',
            'TOTAL TAGIHAN Rp. 287,010.00',
            'Kirim ke Choirul Anam',
            'Biaya Termasuk PPN (Bila ada)',
            'PT. BANK CENTRAL ASIA TBK.',
        ];

        $amount = $this->extractAmount($lines);
        $date = $this->invokePrivate('extractDate', [implode("\n", $lines)]);
        $details = $this->invokePrivate('extractReceiptDetails', [$lines]);
        $note = $this->invokePrivate('buildReceiptNote', [$lines, $details['merchant'], $details]);

        $this->assertSame(287010, $amount);
        $this->assertSame('2026-05-09', $date);
        $this->assertSame('SHOPEE', $details['merchant']);
        $this->assertSame('Choirul Anam', $details['recipient']);
        $this->assertSame('1260895712608030', $details['reference']);
        $this->assertSame('m-Transfer - SHOPEE - ke Choirul Anam - Ref 1260895712608030', $note);
    }

    private function extractAmount(array $lines): ?int
    {
        return $this->invokePrivate('extractAmount', [$lines]);
    }

    private function invokePrivate(string $methodName, array $arguments): mixed
    {
        $method = new ReflectionMethod(ReceiptOcrService::class, $methodName);
        $method->setAccessible(true);

        return $method->invokeArgs(new ReceiptOcrService(), $arguments);
    }
}
