<?php
defined('ABSPATH') || exit;

class CDEP_PRODUCTS
{

    public static function validateMapping($allRows, $headers, $mapping)
    {
        $skuIndex = $mapping['sku'] !== '' ? intval($mapping['sku']) : -1;
        $priceIndex = isset($mapping['price']) && $mapping['price'] !== '' ? intval($mapping['price']) : -1;
        $salePriceIndex = isset($mapping['sale_price']) && $mapping['sale_price'] !== '' ? intval($mapping['sale_price']) : -1;
        $quantityIndex = isset($mapping['quantity']) && $mapping['quantity'] !== '' ? intval($mapping['quantity']) : -1;

        if ($skuIndex < 0) {
            return new WP_Error('missing_sku', 'Debe seleccionar la columna SKU');
        }

        $stats = [
            'total' => count($allRows),
            'found' => 0,
            'not_found_count' => 0,
            'skipped' => 0,
            'not_found' => [],
            'products' => [],
        ];

        foreach ($allRows as $rowIndex => $row) {
            $sku = isset($row[$skuIndex]) ? trim($row[$skuIndex]) : '';

            if (empty($sku)) {
                $stats['skipped']++;
                continue;
            }

            $productId = wc_get_product_id_by_sku($sku);

            if (!$productId) {
                $stats['not_found_count']++;
                $stats['not_found'][] = [
                    'row' => $rowIndex + 2,
                    'sku' => $sku,
                ];
                continue;
            }

            $product = wc_get_product($productId);
            if (!$product) {
                $stats['not_found_count']++;
                $stats['not_found'][] = [
                    'row' => $rowIndex + 2,
                    'sku' => $sku,
                ];
                continue;
            }

            $stats['found']++;

            $newPrice = '';
            if ($priceIndex >= 0 && isset($row[$priceIndex])) {
                $np = floatval(str_replace(['$', ',', ' '], ['', '', ''], $row[$priceIndex]));
                if ($np > 0) $newPrice = $np;
            }

            $newSalePrice = '';
            if ($salePriceIndex >= 0 && isset($row[$salePriceIndex])) {
                $nsp = floatval(str_replace(['$', ',', ' '], ['', '', ''], $row[$salePriceIndex]));
                if ($nsp > 0) $newSalePrice = $nsp;
            }

            $newStock = '';
            if ($quantityIndex >= 0 && isset($row[$quantityIndex])) {
                $newStock = intval($row[$quantityIndex]);
            }

            $thumbnail = get_the_post_thumbnail_url($productId, 'thumbnail');
            if (!$thumbnail && $product->get_type() === 'variation') {
                $thumbnail = get_the_post_thumbnail_url($product->get_parent_id(), 'thumbnail');
            }
            if (!$thumbnail) {
                $thumbnail = wc_placeholder_img_src('thumbnail');
            }
            $imageHtml = '<img src="' . esc_url($thumbnail) . '" width="40" height="40" style="object-fit:cover;border-radius:4px">';

            $terms = wp_get_post_terms($productId, 'product_cat', ['fields' => 'names']);
            $categories = !empty($terms) ? implode(', ', $terms) : '';

            $stockStatus = $product->get_stock_status();
            if ($stockStatus === 'instock') {
                $stockLabel = 'In stock';
            } elseif ($stockStatus === 'outofstock') {
                $stockLabel = 'Out of stock';
            } else {
                $stockLabel = 'On backorder';
            }

            $stats['products'][] = [
                'sku' => $sku,
                'name' => $product->get_name(),
                'image' => $imageHtml,
                'categories' => $categories,
                'stock_status' => $stockLabel,
                'current_price' => $product->get_regular_price(),
                'new_price' => $newPrice,
                'current_sale_price' => $product->get_sale_price(),
                'new_sale_price' => $newSalePrice,
                'current_stock' => $product->get_stock_quantity(),
                'new_stock' => $newStock,
            ];
        }

        return $stats;
    }

    public static function executeUpdate($allRows, $mapping, $offset = 0, $limit = 25)
    {
        $skuIndex = $mapping['sku'] !== '' ? intval($mapping['sku']) : -1;
        $priceIndex = isset($mapping['price']) && $mapping['price'] !== '' ? intval($mapping['price']) : -1;
        $salePriceIndex = isset($mapping['sale_price']) && $mapping['sale_price'] !== '' ? intval($mapping['sale_price']) : -1;
        $quantityIndex = isset($mapping['quantity']) && $mapping['quantity'] !== '' ? intval($mapping['quantity']) : -1;

        if ($skuIndex < 0) {
            return new WP_Error('missing_sku', 'Debe seleccionar la columna SKU');
        }

        $batch = array_slice($allRows, $offset, $limit);
        $results = [
            'updated' => 0,
            'errors' => [],
            'completed' => false,
            'processed_skus' => [],
        ];

        foreach ($batch as $rowIndex => $row) {
            $sku = isset($row[$skuIndex]) ? trim($row[$skuIndex]) : '';

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
                    $product->set_regular_price($newPrice > 0 ? $newPrice : '');
                    $changed = true;
                }

                if ($salePriceIndex >= 0 && isset($row[$salePriceIndex])) {
                    $newSalePrice = floatval(str_replace(['$', ',', ' '], ['', '', ''], $row[$salePriceIndex]));
                    $product->set_sale_price($newSalePrice > 0 ? $newSalePrice : '');
                    $changed = true;
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

                $results['processed_skus'][] = $sku;
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

    $cached = CDEP_DRIVE::getCachedData();
    if (empty($cached) || empty($cached['all_rows'])) {
        wp_send_json_error('No hay datos en caché. Seleccione el archivo nuevamente.');
    }

    $result = CDEP_PRODUCTS::validateMapping($cached['all_rows'], $cached['headers'], $mapping);

    if (is_wp_error($result)) {
        wp_send_json_error($result->get_error_message());
    }

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

    $cached = CDEP_DRIVE::getCachedData();
    if (empty($cached) || empty($cached['all_rows'])) {
        wp_send_json_error('No hay datos en caché');
    }

    $result = CDEP_PRODUCTS::executeUpdate($cached['all_rows'], $mapping, $offset, $limit);

    if (is_wp_error($result)) {
        wp_send_json_error($result->get_error_message());
    }

    wp_send_json_success($result);
});
