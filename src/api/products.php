<?php
defined('ABSPATH') || exit;

class CDEP_PRODUCTS {

    public static function validateMapping($allRows, $headers, $mapping) {
        $skuIndex = intval($mapping['sku'] ?? -1);
        $priceIndex = intval($mapping['price'] ?? -1);
        $quantityIndex = intval($mapping['quantity'] ?? -1);

        if ($skuIndex < 0) {
            return new WP_Error('missing_sku', 'Debe seleccionar la columna SKU');
        }

        if ($priceIndex < 0 && $quantityIndex < 0) {
            return new WP_Error('missing_fields', 'Debe seleccionar al menos Precio o Cantidad');
        }

        $stats = [
            'total' => count($allRows),
            'found' => 0,
            'not_found' => 0,
            'skipped' => 0,
            'errors' => [],
        ];

        foreach ($allRows as $rowIndex => $row) {
            $sku = $row[$skuIndex] ?? '';

            if (empty($sku)) {
                $stats['skipped']++;
                continue;
            }

            $productId = wc_get_product_id_by_sku($sku);

            if (!$productId) {
                $stats['not_found']++;
                $stats['errors'][] = [
                    'row' => $rowIndex + 2,
                    'sku' => $sku,
                    'error' => 'Producto no encontrado',
                ];
                continue;
            }

            $stats['found']++;

            $product = wc_get_product($productId);
            if (!$product) {
                $stats['not_found']++;
                continue;
            }

            $changes = [];

            if ($priceIndex >= 0 && isset($row[$priceIndex])) {
                $newPrice = floatval(str_replace(['$', ',', ' '], ['', '', ''], $row[$priceIndex]));
                if ($newPrice > 0) {
                    $changes['price'] = [
                        'old' => $product->get_price(),
                        'new' => $newPrice,
                    ];
                }
            }

            if ($quantityIndex >= 0 && isset($row[$quantityIndex])) {
                $newQty = intval($row[$quantityIndex]);
                $changes['quantity'] = [
                    'old' => $product->get_stock_quantity(),
                    'new' => $newQty,
                ];
            }

            $stats['changes'][$sku] = $changes;
        }

        return $stats;
    }

    public static function executeUpdate($allRows, $mapping, $offset = 0, $limit = 25) {
        $skuIndex = intval($mapping['sku'] ?? -1);
        $priceIndex = intval($mapping['price'] ?? -1);
        $quantityIndex = intval($mapping['quantity'] ?? -1);

        if ($skuIndex < 0) {
            return new WP_Error('missing_sku', 'Debe seleccionar la columna SKU');
        }

        $batch = array_slice($allRows, $offset, $limit);
        $results = [
            'updated' => 0,
            'errors' => [],
            'completed' => false,
        ];

        foreach ($batch as $rowIndex => $row) {
            $sku = $row[$skuIndex] ?? '';

            if (empty($sku)) {
                continue;
            }

            $productId = wc_get_product_id_by_sku($sku);
            if (!$productId) {
                $results['errors'][] = [
                    'row' => $offset + $rowIndex + 2,
                    'sku' => $sku,
                    'error' => 'Producto no encontrado',
                ];
                continue;
            }

            $product = wc_get_product($productId);
            if (!$product) {
                $results['errors'][] = [
                    'row' => $offset + $rowIndex + 2,
                    'sku' => $sku,
                    'error' => 'Producto inválido',
                ];
                continue;
            }

            try {
                $changed = false;

                if ($priceIndex >= 0 && isset($row[$priceIndex])) {
                    $newPrice = floatval(str_replace(['$', ',', ' '], ['', '', ''], $row[$priceIndex]));
                    if ($newPrice > 0) {
                        $product->set_regular_price($newPrice);
                        $changed = true;
                    }
                }

                if ($quantityIndex >= 0 && isset($row[$quantityIndex])) {
                    $newQty = intval($row[$quantityIndex]);
                    $product->set_stock_quantity($newQty);
                    $product->set_stock_status($newQty > 0 ? 'instock' : 'outofstock');
                    if (!$product->get_manage_stock()) {
                        $product->set_manage_stock(true);
                    }
                    $changed = true;
                }

                if ($changed) {
                    $product->save();
                    $results['updated']++;
                }
            } catch (Exception $e) {
                $results['errors'][] = [
                    'row' => $offset + $rowIndex + 2,
                    'sku' => $sku,
                    'error' => $e->getMessage(),
                ];
            }
        }

        $nextOffset = $offset + $limit;
        $results['completed'] = $nextOffset >= count($allRows);
        $results['next_offset'] = $nextOffset;

        return $results;
    }
}

add_action('wp_ajax_cdep_update_preview', function () {
    if (!current_user_can('manage_options')) {
        wp_send_json_error('Unauthorized');
    }
    check_ajax_referer('cdep_nonce', 'nonce');

    $mapping = $_POST['mapping'] ?? [];
    $selected = CDEP_DRIVE::getSelectedFile();

    if (empty($selected['file_id'])) {
        wp_send_json_error('No hay archivo seleccionado');
    }

    $uploadDir = wp_upload_dir();
    $tempFile = $uploadDir['path'] . '/' . sanitize_file_name($selected['file_name']);

    if (!file_exists($tempFile)) {
        wp_send_json_error('Archivo temporal no encontrado. Seleccione el archivo nuevamente.');
    }

    try {
        $parsed = CDEP_EXCEL::parse($tempFile);
    } catch (Exception $e) {
        wp_send_json_error($e->getMessage());
        return;
    }

    $result = CDEP_PRODUCTS::validateMapping($parsed['all_rows'], $parsed['headers'], $mapping);

    if (is_wp_error($result)) {
        wp_send_json_error($result->get_error_message());
    }

    $result['total'] = $parsed['total_rows'];
    $result['file_name'] = $selected['file_name'];

    wp_send_json_success($result);
});

add_action('wp_ajax_cdep_update_execute', function () {
    if (!current_user_can('manage_options')) {
        wp_send_json_error('Unauthorized');
    }
    check_ajax_referer('cdep_nonce', 'nonce');

    $mapping = $_POST['mapping'] ?? [];
    $offset = intval($_POST['offset'] ?? 0);
    $limit = intval($_POST['limit'] ?? 25);
    $selected = CDEP_DRIVE::getSelectedFile();

    if (empty($selected['file_id'])) {
        wp_send_json_error('No hay archivo seleccionado');
    }

    $uploadDir = wp_upload_dir();
    $tempFile = $uploadDir['path'] . '/' . sanitize_file_name($selected['file_name']);

    if (!file_exists($tempFile)) {
        wp_send_json_error('Archivo temporal no encontrado');
    }

    try {
        $parsed = CDEP_EXCEL::parse($tempFile);
    } catch (Exception $e) {
        wp_send_json_error($e->getMessage());
        return;
    }

    $result = CDEP_PRODUCTS::executeUpdate($parsed['all_rows'], $mapping, $offset, $limit);

    if (is_wp_error($result)) {
        wp_send_json_error($result->get_error_message());
    }

    wp_send_json_success($result);
});
