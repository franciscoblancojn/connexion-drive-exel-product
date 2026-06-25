<?php
defined('ABSPATH') || exit;

class CDEP_PRODUCTS
{
    private static $fields = array(
        'regular_price' => array('label' => 'Precio regular', 'type' => 'float'),
        'sale_price' => array('label' => 'Precio de oferta', 'type' => 'float'),
        'stock_quantity' => array('label' => 'Cantidad en stock', 'type' => 'int'),
        'stock_status' => array('label' => 'Estado de stock', 'type' => 'string'),
        'weight' => array('label' => 'Peso', 'type' => 'float'),
        'length' => array('label' => 'Largo', 'type' => 'float'),
        'width' => array('label' => 'Ancho', 'type' => 'float'),
        'height' => array('label' => 'Alto', 'type' => 'float'),
        'manage_stock' => array('label' => 'Gestionar stock', 'type' => 'bool'),
        'backorders' => array('label' => 'Backorders', 'type' => 'string'),
        'tax_status' => array('label' => 'Estado de impuesto', 'type' => 'string'),
        'tax_class' => array('label' => 'Clase de impuesto', 'type' => 'string'),
        'post_status' => array('label' => 'Estado del producto', 'type' => 'string'),
        'product_name' => array('label' => 'Nombre del producto', 'type' => 'string'),
        'short_description' => array('label' => 'Descripción corta', 'type' => 'string'),
        'description' => array('label' => 'Descripción', 'type' => 'string'),
    );

    public static function getFields()
    {
        return self::$fields;
    }

    private static function sanitizeValue($value, $type)
    {
        switch ($type) {
            case 'float':
                return floatval(str_replace(array('$', ',', ' '), array('', '', ''), $value));
            case 'int':
                return intval($value);
            case 'bool':
                return in_array(strtolower(trim($value)), array('sí', 'si', 'yes', '1', 'true', 'on'));
            default:
                return trim($value);
        }
    }

    private static function getProductField($product, $field)
    {
        switch ($field) {
            case 'regular_price': return $product->get_regular_price();
            case 'sale_price': return $product->get_sale_price();
            case 'stock_quantity': return $product->get_stock_quantity();
            case 'stock_status': return $product->get_stock_status();
            case 'weight': return $product->get_weight();
            case 'length': return $product->get_length();
            case 'width': return $product->get_width();
            case 'height': return $product->get_height();
            case 'manage_stock': return $product->get_manage_stock() ? 'sí' : 'no';
            case 'backorders': return $product->get_backorders();
            case 'tax_status': return $product->get_tax_status();
            case 'tax_class': return $product->get_tax_class();
            case 'post_status': return $product->get_status();
            case 'product_name': return $product->get_name();
            case 'short_description': return $product->get_short_description();
            case 'description': return $product->get_description();
            default: return '';
        }
    }

    private static function setProductField($product, $field, $value, $type)
    {
        $sanitized = self::sanitizeValue($value, $type);

        switch ($field) {
            case 'regular_price':
                $product->set_regular_price($sanitized > 0 ? strval($sanitized) : '');
                break;
            case 'sale_price':
                $product->set_sale_price($sanitized > 0 ? strval($sanitized) : '');
                break;
            case 'stock_quantity':
                $product->set_stock_quantity(intval($sanitized));
                if (!$product->get_manage_stock()) {
                    $product->set_manage_stock(true);
                }
                break;
            case 'stock_status':
                $product->set_stock_status(strval($sanitized));
                break;
            case 'weight':
                $product->set_weight(floatval($sanitized));
                break;
            case 'length':
                $product->set_length(floatval($sanitized));
                break;
            case 'width':
                $product->set_width(floatval($sanitized));
                break;
            case 'height':
                $product->set_height(floatval($sanitized));
                break;
            case 'manage_stock':
                $product->set_manage_stock($sanitized === true);
                break;
            case 'backorders':
                $product->set_backorders(strval($sanitized));
                break;
            case 'tax_status':
                $product->set_tax_status(strval($sanitized));
                break;
            case 'tax_class':
                $product->set_tax_class(strval($sanitized));
                break;
            case 'post_status':
                $product->set_status(strval($sanitized));
                break;
            case 'product_name':
                $product->set_name(strval($sanitized));
                break;
            case 'short_description':
                $product->set_short_description(strval($sanitized));
                break;
            case 'description':
                $product->set_description(strval($sanitized));
                break;
        }
    }

    public static function validateMapping($allRows, $mapping)
    {
        $skuIndex = isset($mapping['sku']) && $mapping['sku'] !== '' ? intval($mapping['sku']) : -1;

        if ($skuIndex < 0) {
            return new WP_Error('missing_sku', 'Debe seleccionar la columna SKU');
        }

        $fieldMapping = array();
        foreach ($mapping as $key => $colIndex) {
            if ($key !== 'sku' && $colIndex !== '' && isset(self::$fields[$key])) {
                $fieldMapping[$key] = intval($colIndex);
            }
        }

        $products = array();
        $found = 0;
        $newCount = 0;

        foreach ($allRows as $rowIndex => $row) {
            $sku = isset($row[$skuIndex]) ? trim($row[$skuIndex]) : '';

            if (empty($sku)) {
                continue;
            }

            $productId = wc_get_product_id_by_sku($sku);
            $product = $productId ? wc_get_product($productId) : false;
            $exists = $productId && $product;
            $status = $exists ? 'pending' : 'new';

            if ($exists) {
                $found++;
            } else {
                $newCount++;
            }

            $productData = array(
                'sku' => $sku,
                'row' => $rowIndex + 2,
                'exists' => $exists,
                'status' => $status,
                'name' => '',
                'image' => '',
                'categories' => '',
                'fields' => array(),
            );

            if ($exists) {
                $productData['name'] = $product->get_name();

                $thumbnail = get_the_post_thumbnail_url($productId, 'thumbnail');
                if (!$thumbnail && $product->get_type() === 'variation') {
                    $thumbnail = get_the_post_thumbnail_url($product->get_parent_id(), 'thumbnail');
                }
                if (!$thumbnail) {
                    $thumbnail = wc_placeholder_img_src('thumbnail');
                }
                $productData['image'] = '<img src="' . esc_url($thumbnail) . '" width="40" height="40" style="object-fit:cover;border-radius:4px">';

                $terms = wp_get_post_terms($productId, 'product_cat', array('fields' => 'names'));
                $productData['categories'] = !empty($terms) ? implode(', ', $terms) : '';
            }

            foreach ($fieldMapping as $field => $colIndex) {
                $newValue = isset($row[$colIndex]) ? trim($row[$colIndex]) : '';
                $currentValue = $exists ? self::getProductField($product, $field) : '';

                // Detect changes (numeric for prices/qty, string for text)
                $changed = $exists;
                $numericFields = array('regular_price', 'sale_price', 'stock_quantity', 'weight', 'length', 'width', 'height');
                if ($changed) {
                    if (in_array($field, $numericFields)) {
                        $normCurrent = floatval(preg_replace('/[^0-9.eE\-]/', '', strval($currentValue)));
                        $normNew = floatval(preg_replace('/[^0-9.eE\-]/', '', strval($newValue)));
                        $changed = (strval($normCurrent) !== strval($normNew));
                    } else {
                        $changed = (trim(strval($currentValue)) !== trim(strval($newValue)));
                    }
                }

                // Format display values consistently
                $displayCurrent = $currentValue !== null && $currentValue !== '' ? strval($currentValue) : '';
                $displayNew = $newValue;

                if (in_array($field, array('regular_price', 'sale_price'))) {
                    $rawCurrent = floatval(preg_replace('/[^0-9.eE\-]/', '', strval($currentValue)));
                    $rawNew = floatval(preg_replace('/[^0-9.eE\-]/', '', strval($newValue)));
                    if ($rawCurrent > 0) {
                        $displayCurrent = html_entity_decode(strip_tags(wc_price($rawCurrent)), ENT_QUOTES, 'UTF-8');
                    }
                    if ($rawNew > 0) {
                        $displayNew = html_entity_decode(strip_tags(wc_price($rawNew)), ENT_QUOTES, 'UTF-8');
                    }
                }

                $productData['fields'][$field] = array(
                    'current' => $displayCurrent,
                    'new' => $displayNew,
                    'changed' => $changed,
                );
            }

            $products[] = $productData;
        }

        $fieldLabels = array();
        foreach ($fieldMapping as $field => $colIndex) {
            if (isset(self::$fields[$field])) {
                $fieldLabels[$field] = self::$fields[$field]['label'];
            }
        }

        return array(
            'total' => count($products),
            'found' => $found,
            'new_count' => $newCount,
            'products' => $products,
            'field_labels' => $fieldLabels,
        );
    }

    public static function executeUpdate($allRows, $mapping, $offset = 0, $limit = 25)
    {
        $skuIndex = isset($mapping['sku']) && $mapping['sku'] !== '' ? intval($mapping['sku']) : -1;

        if ($skuIndex < 0) {
            return new WP_Error('missing_sku', 'Debe seleccionar la columna SKU');
        }

        $fieldMapping = array();
        foreach ($mapping as $key => $colIndex) {
            if ($key !== 'sku' && $colIndex !== '' && isset(self::$fields[$key])) {
                $fieldMapping[$key] = intval($colIndex);
            }
        }

        $batch = array_slice($allRows, $offset, $limit);
        $results = array(
            'updated' => 0,
            'created' => 0,
            'errors' => array(),
            'completed' => false,
            'processed_skus' => array(),
        );

        foreach ($batch as $rowIndex => $row) {
            $sku = isset($row[$skuIndex]) ? trim($row[$skuIndex]) : '';

            if (empty($sku)) {
                continue;
            }

            $productId = wc_get_product_id_by_sku($sku);

            if ($productId) {
                $product = wc_get_product($productId);
                if (!$product) {
                    $results['errors'][] = array(
                        'row' => $offset + $rowIndex + 2,
                        'sku' => $sku,
                        'error' => 'Producto inválido',
                    );
                    continue;
                }
                $isNew = false;
            } else {
                $product = new WC_Product();
                $product->set_sku($sku);
                $product->set_status('pending');
                $isNew = true;
            }

            try {
                foreach ($fieldMapping as $field => $colIndex) {
                    if (isset($row[$colIndex])) {
                        self::setProductField($product, $field, $row[$colIndex], self::$fields[$field]['type']);
                    }
                }

                $product->save();

                if ($isNew) {
                    $results['created']++;
                    $results['processed_skus'][] = array('sku' => $sku, 'status' => 'created');
                } else {
                    $results['updated']++;
                    $results['processed_skus'][] = array('sku' => $sku, 'status' => 'updated');
                }
            } catch (Exception $e) {
                $results['errors'][] = array(
                    'row' => $offset + $rowIndex + 2,
                    'sku' => $sku,
                    'error' => $e->getMessage(),
                );
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

    $mapping = isset($_POST['mapping']) ? $_POST['mapping'] : array();
    $selected = CDEP_DRIVE::getSelectedFile();

    if (empty($selected['file_id'])) {
        wp_send_json_error('No hay archivo seleccionado');
    }

    $cached = CDEP_DRIVE::getCachedData();
    if (empty($cached) || empty($cached['all_rows'])) {
        wp_send_json_error('No hay datos en caché. Seleccione el archivo nuevamente.');
    }

    $result = CDEP_PRODUCTS::validateMapping($cached['all_rows'], $mapping);

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

    $mapping = isset($_POST['mapping']) ? $_POST['mapping'] : array();
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

add_action('wp_ajax_cdep_update_batch_skus', function () {
    if (!current_user_can('manage_options')) {
        wp_send_json_error('Unauthorized');
    }
    check_ajax_referer('cdep_nonce', 'nonce');

    $skus = isset($_POST['skus']) ? $_POST['skus'] : array();
    $mapping = isset($_POST['mapping']) ? $_POST['mapping'] : array();

    if (empty($skus) || !is_array($skus)) {
        wp_send_json_error('No se recibieron SKUs');
    }

    $skus = array_map('sanitize_text_field', $skus);

    $cached = CDEP_DRIVE::getCachedData();
    if (empty($cached) || empty($cached['all_rows'])) {
        wp_send_json_error('No hay datos en caché');
    }

    $skuIndex = isset($mapping['sku']) && $mapping['sku'] !== '' ? intval($mapping['sku']) : -1;
    if ($skuIndex < 0) {
        wp_send_json_error('Mapeo SKU inválido');
    }

    $rowsToProcess = array();
    foreach ($cached['all_rows'] as $row) {
        $rowSku = isset($row[$skuIndex]) ? trim($row[$skuIndex]) : '';
        if (in_array($rowSku, $skus)) {
            $rowsToProcess[] = $row;
        }
    }

    if (empty($rowsToProcess)) {
        wp_send_json_error('No se encontraron filas con los SKUs proporcionados');
    }

    $result = CDEP_PRODUCTS::executeUpdate($rowsToProcess, $mapping, 0, count($rowsToProcess));

    if (is_wp_error($result)) {
        wp_send_json_error($result->get_error_message());
    }

    wp_send_json_success($result);
});

add_action('wp_ajax_cdep_update_single', function () {
    if (!current_user_can('manage_options')) {
        wp_send_json_error('Unauthorized');
    }
    check_ajax_referer('cdep_nonce', 'nonce');

    $sku = sanitize_text_field($_POST['sku'] ?? '');
    $mapping = isset($_POST['mapping']) ? $_POST['mapping'] : array();

    if (empty($sku)) {
        wp_send_json_error('SKU vacío');
    }

    $cached = CDEP_DRIVE::getCachedData();
    if (empty($cached) || empty($cached['all_rows'])) {
        wp_send_json_error('No hay datos en caché');
    }

    $skuIndex = isset($mapping['sku']) && $mapping['sku'] !== '' ? intval($mapping['sku']) : -1;
    if ($skuIndex < 0) {
        wp_send_json_error('Mapeo SKU inválido');
    }

    $foundRow = null;
    foreach ($cached['all_rows'] as $row) {
        if (isset($row[$skuIndex]) && trim($row[$skuIndex]) === $sku) {
            $foundRow = $row;
            break;
        }
    }

    if ($foundRow === null) {
        wp_send_json_error('SKU no encontrado en el archivo');
    }

    $result = CDEP_PRODUCTS::executeUpdate(array($foundRow), $mapping, 0, 1);

    if (is_wp_error($result)) {
        wp_send_json_error($result->get_error_message());
    }

    wp_send_json_success($result);
});
