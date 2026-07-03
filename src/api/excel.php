<?php
defined('ABSPATH') || exit;

class CDEP_EXCEL {

    public static function parse($filePath, $headerRow = 0, $delimiter = null) {
        if (!file_exists($filePath)) {
            throw new Exception('File not found: ' . $filePath);
        }

        $extension = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));

        // Normalize delimiter: TAB -> actual tab char
        if ($delimiter === 'TAB') {
            $delimiter = "\t";
        }

        if (in_array($extension, ['xlsx', 'xls'])) {
            return self::parseWithPhpSpreadsheet($filePath, $headerRow);
        } elseif ($extension === 'csv') {
            return self::parseCSV($filePath, $headerRow, $delimiter);
        } else {
            throw new Exception('Unsupported file format: ' . $extension);
        }
    }

    private static function parseWithPhpSpreadsheet($filePath, $headerRow = 0) {
        if (!class_exists('PhpOffice\PhpSpreadsheet\IOFactory')) {
            throw new Exception('PhpSpreadsheet library not available. Run composer install.');
        }

        $spreadsheet = \PhpOffice\PhpSpreadsheet\IOFactory::load($filePath);
        $worksheet = $spreadsheet->getActiveSheet();
        $data = $worksheet->toArray();

        if (empty($data)) {
            throw new Exception('El archivo Excel está vacío');
        }

        $rawHeaders = $data[$headerRow] ?? [];
        $headers = array_map('strval', array_map('trim', $rawHeaders));
        $rows = array_slice($data, $headerRow + 1);

        $filteredRows = [];
        foreach ($rows as $row) {
            $row = array_map('strval', array_map('trim', $row));
            $values = array_filter($row, function ($v) {
                return $v !== '';
            });
            if (!empty($values)) {
                $filteredRows[] = $row;
            }
        }

        // Build headerIndex excluding empty headers
        $headerIndex = [];
        foreach ($headers as $i => $h) {
            if ($h === '') {
                continue;
            }
            $headerIndex[] = [
                'index' => $i,
                'name' => $h,
                'sample' => isset($filteredRows[0][$i]) ? $filteredRows[0][$i] : '',
            ];
        }

        $sample = array_slice($filteredRows, 0, 10);
        $detected = self::detectColumns($headers);

        return [
            'headers' => $headerIndex,
            'sample' => $sample,
            'detected' => $detected,
            'total_rows' => count($filteredRows),
            'all_rows' => $filteredRows,
        ];
    }

    private static function detectDelimiter($line) {
        $delimiters = array(',' => 0, ';' => 0, "\t" => 0);
        foreach ($delimiters as $delim => $count) {
            $delimiters[$delim] = substr_count($line, $delim);
        }
        arsort($delimiters);
        reset($delimiters);
        $mostCommon = key($delimiters);
        return $delimiters[$mostCommon] > 0 ? $mostCommon : ',';
    }

    private static function parseCSV($filePath, $headerRow = 0, $delimiter = null) {
        $handle = fopen($filePath, 'r');
        if (!$handle) {
            throw new Exception('Cannot open CSV file');
        }

        if ($delimiter === null) {
            $firstLine = fgets($handle);
            rewind($handle);
            $delimiter = self::detectDelimiter($firstLine);
        }

        $allLines = array();
        while (($row = fgetcsv($handle, 0, $delimiter)) !== false) {
            $allLines[] = array_map('trim', $row);
        }
        fclose($handle);

        if (empty($allLines)) {
            throw new Exception('El archivo CSV está vacío');
        }

        $rawHeaders = $allLines[$headerRow] ?? [];
        $headers = array_map('trim', $rawHeaders);
        $rows = array_slice($allLines, $headerRow + 1);

        $filteredRows = [];
        foreach ($rows as $row) {
            $values = array_filter($row, function ($v) {
                return $v !== '';
            });
            if (!empty($values)) {
                $filteredRows[] = $row;
            }
        }

        // Build headerIndex excluding empty headers
        $headerIndex = [];
        foreach ($headers as $i => $h) {
            if ($h === '') {
                continue;
            }
            $headerIndex[] = [
                'index' => $i,
                'name' => $h,
                'sample' => isset($filteredRows[0][$i]) ? $filteredRows[0][$i] : '',
            ];
        }

        $sample = array_slice($filteredRows, 0, 10);
        $detected = self::detectColumns($headers);

        return [
            'headers' => $headerIndex,
            'sample' => $sample,
            'detected' => $detected,
            'total_rows' => count($filteredRows),
            'all_rows' => $filteredRows,
        ];
    }

    public static function detectColumns($headers) {
        $detected = [
            'sku' => null,
            'price' => null,
            'sale_price' => null,
            'quantity' => null,
        ];

        $skuPatterns = ['/sku/i', '/código/i', '/codigo/i', '/cod/i', '/referencia/i', '/ref/i', '/product.*id/i', '/id.*product/i', '/item.*id/i'];
        $pricePatterns = ['/price/i', '/precio/i', '/cost/i', '/costo/i', '/pvp/i', '/precio_venta/i', '/precio_neto/i', '/neto/i', '/importe/i', '/valor/i'];
        $salePricePatterns = ['/sale.*price/i', '/offer.*price/i', '/precio.*oferta/i', '/precio.*rebaj/i', '/special.*price/i', '/promo.*price/i', '/descuento/i', '/precio.*promo/i'];
        $quantityPatterns = ['/quantity/i', '/cantidad/i', '/stock/i', '/qty/i', '/inventario/i', '/existencia/i', '/unidades/i', '/inventory/i'];

        foreach ($headers as $i => $header) {
            $headerLower = strtolower(trim($header));

            if ($detected['sku'] === null) {
                foreach ($skuPatterns as $pattern) {
                    if (preg_match($pattern, $headerLower)) {
                        $detected['sku'] = $i;
                        break 2;
                    }
                }
                if (in_array($headerLower, ['sku', 'skuid', 'sku_id', 'product_sku'])) {
                    $detected['sku'] = $i;
                }
            }
        }

        foreach ($headers as $i => $header) {
            $headerLower = strtolower(trim($header));

            if ($detected['price'] === null && $i !== $detected['sku']) {
                foreach ($pricePatterns as $pattern) {
                    if (preg_match($pattern, $headerLower)) {
                        $detected['price'] = $i;
                        break;
                    }
                }
            }
        }

        foreach ($headers as $i => $header) {
            $headerLower = strtolower(trim($header));

            if ($detected['sale_price'] === null && $i !== $detected['sku'] && $i !== $detected['price']) {
                foreach ($salePricePatterns as $pattern) {
                    if (preg_match($pattern, $headerLower)) {
                        $detected['sale_price'] = $i;
                        break;
                    }
                }
            }
        }

        foreach ($headers as $i => $header) {
            $headerLower = strtolower(trim($header));

            if ($detected['quantity'] === null && $i !== $detected['sku'] && $i !== $detected['price'] && $i !== $detected['sale_price']) {
                foreach ($quantityPatterns as $pattern) {
                    if (preg_match($pattern, $headerLower)) {
                        $detected['quantity'] = $i;
                        break;
                    }
                }
            }
        }

        return $detected;
    }
}
