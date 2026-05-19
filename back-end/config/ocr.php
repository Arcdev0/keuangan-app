<?php

return [
    'tesseract_path' => env('TESSERACT_PATH', 'tesseract'),
    'language' => env('TESSERACT_LANGUAGE', 'ind+eng'),
    'timeout' => (int) env('TESSERACT_TIMEOUT', 20),
];
