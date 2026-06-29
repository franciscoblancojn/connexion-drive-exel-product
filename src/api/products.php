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

    public static function resolveTemplate($template, $row, $headers, $configVars = array())
    {
        return preg_replace_callback('/\{([^}]+)\}/', function ($matches) use ($row, $headers, $configVars) {
            $placeholder = trim($matches[1]);
            // Check config variables first (from Configuraciones de Creacion)
            if (isset($configVars[$placeholder])) {
                return $configVars[$placeholder];
            }
            // Check column headers
            foreach ($headers as $h) {
                if ($h['name'] === $placeholder) {
                    $idx = intval($h['index']);
                    return isset($row[$idx]) ? trim($row[$idx]) : '';
                }
            }
            return $matches[0];
        }, $template);
    }

    private static function resolveCalc($expression, $row, $headers, $configVars = array())
    {
        $resolved = preg_replace_callback('/\{([^}]+)\}/', function ($matches) use ($row, $headers, $configVars) {
            $placeholder = trim($matches[1]);
            if (isset($configVars[$placeholder])) {
                return floatval($configVars[$placeholder]);
            }
            foreach ($headers as $h) {
                if ($h['name'] === $placeholder) {
                    $idx = intval($h['index']);
                    return isset($row[$idx]) ? floatval(trim($row[$idx])) : 0;
                }
            }
            return 0;
        }, $expression);

        if (!preg_match('/^[\d\s\+\-\*\/\(\)\.]+$/', $resolved)) {
            return $resolved;
        }

        $result = @eval("return $resolved;");
        return $result === false ? 0 : floatval($result);
    }

    private static function evaluateCondition($condition, $row)
    {
        $colIndex = isset($condition['column']) ? intval($condition['column']) : -1;
        $condValue = isset($condition['value']) ? trim($condition['value']) : '';
        $operator = isset($condition['operator']) ? $condition['operator'] : '=';
        if ($colIndex < 0 || $condValue === '') {
            return true;
        }
        $rowValue = isset($row[$colIndex]) ? trim($row[$colIndex]) : '';
        switch ($operator) {
            case '!=':
                return strcasecmp($rowValue, $condValue) !== 0;
            case '<':
                return floatval($rowValue) < floatval($condValue);
            case '>':
                return floatval($rowValue) > floatval($condValue);
            case '=':
            default:
                return strcasecmp($rowValue, $condValue) === 0;
        }
    }

    public static function validateMapping($allRows, $mapping, $headers = array(), $configVars = array(), $aiData = array(), $manualData = array())
    {
        $skuIndex = isset($mapping['sku']) && $mapping['sku'] !== '' ? intval($mapping['sku']) : -1;

        if ($skuIndex < 0) {
            return new WP_Error('missing_sku', 'Debe seleccionar la columna SKU');
        }

        $creationBrand = isset($mapping['creation_brand']) ? sanitize_text_field($mapping['creation_brand']) : '';
        $creationCategory = isset($mapping['creation_category']) ? sanitize_text_field($mapping['creation_category']) : '';
        $creationAttributes = isset($mapping['attributes']) ? $mapping['attributes'] : array();
        $conditions = isset($mapping['conditions']) ? $mapping['conditions'] : array();

        // Handle manual brand/category
        $brandManual = ($creationBrand === '__manual__');
        $categoryManual = ($creationCategory === '__manual__');
        if ($brandManual) $creationBrand = '';
        if ($categoryManual) $creationCategory = '';

        $autoManualEmpty = isset($mapping['auto_manual_empty']) && $mapping['auto_manual_empty'] === '1';

        // Split mapping: update fields for existing products, create fields for new products
        $updateFields = array('regular_price', 'sale_price', 'stock_quantity');
        $updateMapping = array();
        $createMapping = array();
        $aiFields = array();
        foreach ($mapping as $key => $colIndex) {
            if ($key === 'sku' || $colIndex === '') {
                continue;
            }
            if (strpos($key, 'create_') === 0) {
                $realKey = substr($key, 7);
                if (isset(self::$fields[$realKey])) {
                    if ($colIndex === '__ai__') {
                        $createMapping[$realKey] = '__ai__';
                        $aiFields[] = $realKey;
                    } elseif ($colIndex === '__manual__') {
                        $createMapping[$realKey] = '__manual__';
                    } elseif (is_string($colIndex) && strpos($colIndex, 'custom:') === 0) {
                        $createMapping[$realKey] = $colIndex;
                    } elseif (is_string($colIndex) && strpos($colIndex, 'calc:') === 0) {
                        $createMapping[$realKey] = $colIndex;
                    } else {
                        $createMapping[$realKey] = intval($colIndex);
                    }
                }
            } elseif (isset(self::$fields[$key])) {
                if (is_string($colIndex) && strpos($colIndex, 'calc:') === 0) {
                    $updateMapping[$key] = $colIndex;
                } else {
                    $updateMapping[$key] = intval($colIndex);
                }
                $createMapping[$key] = intval($colIndex);
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
                'product_id' => $productId ? intval($productId) : 0,
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
            } elseif (isset($conditions['categoria'])) {
                // Preview: show what category would be applied if condition matches
                $condList = $conditions['categoria'];
                if (isset($condList['column'])) {
                    $condList = array($condList);
                }
                foreach ($condList as $cond) {
                    if (self::evaluateCondition($cond, $row)) {
                        $effectiveCategory = isset($cond['apply']) ? sanitize_text_field($cond['apply']) : '';
                        if (!empty($effectiveCategory)) {
                            $productData['categories'] = $effectiveCategory;
                        }
                        break;
                    }
                }
            } elseif (!empty($creationCategory)) {
                $productData['categories'] = $creationCategory;
            }

            // Evaluate attributes for new products (preview)
            if (!$exists && !empty($creationAttributes) && is_array($creationAttributes)) {
                $effectiveAttrs = array();
                foreach ($creationAttributes as $attrItem) {
                    $taxName = isset($attrItem['taxonomy']) ? sanitize_text_field($attrItem['taxonomy']) : '';
                    $termName = isset($attrItem['term']) ? sanitize_text_field($attrItem['term']) : '';
                    $attrConditions = isset($attrItem['conditions']) ? $attrItem['conditions'] : null;
                    if (empty($taxName)) {
                        continue;
                    }
                    // If conditions exist, use first matching condition's apply as term
                    if (!empty($attrConditions) && is_array($attrConditions)) {
                        foreach ($attrConditions as $cond) {
                            if (self::evaluateCondition($cond, $row)) {
                                $termName = isset($cond['apply']) ? sanitize_text_field($cond['apply']) : '';
                                break;
                            }
                        }
                        if (empty($termName)) {
                            continue;
                        }
                    } elseif (empty($termName)) {
                        continue;
                    }
                    $label = wc_attribute_label('pa_' . $taxName);
                    $effectiveAttrs[] = $label . ': ' . $termName;
                }
                $productData['attributes'] = $effectiveAttrs;
            }

            // Use appropriate mapping: only update fields for existing, all fields for new
            $activeMapping = $exists ? $updateMapping : $createMapping;

            foreach ($activeMapping as $field => $colIndex) {
                $newValue = '';
                if ($colIndex === '__ai__') {
                    $newValue = isset($aiData[$sku][$field]) ? $aiData[$sku][$field] : '';
                } elseif ($colIndex === '__manual__') {
                    $newValue = isset($manualData[$sku][$field]) ? $manualData[$sku][$field] : '';
                } elseif (is_string($colIndex) && strpos($colIndex, 'custom:') === 0) {
                    $template = substr($colIndex, 7);
                    $newValue = self::resolveTemplate($template, $row, $headers, $configVars);
                } elseif (is_string($colIndex) && strpos($colIndex, 'calc:') === 0) {
                    $expr = substr($colIndex, 5);
                    $newValue = self::resolveCalc($expr, $row, $headers, $configVars);
                } else {
                    $newValue = isset($row[$colIndex]) ? trim($row[$colIndex]) : '';
                }
                // Auto-manual override: use manual data for empty values
                if ($autoManualEmpty && empty($newValue) && isset($manualData[$sku][$field])) {
                    $newValue = $manualData[$sku][$field];
                }
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

        $updateFieldLabels = array();
        foreach ($updateMapping as $field => $colIndex) {
            if (isset(self::$fields[$field])) {
                $updateFieldLabels[$field] = self::$fields[$field]['label'];
            }
        }

        $createFieldLabels = array();
        foreach ($createMapping as $field => $colIndex) {
            if (isset(self::$fields[$field])) {
                $createFieldLabels[$field] = self::$fields[$field]['label'];
            }
        }

        $fieldLabels = array_merge($updateFieldLabels, $createFieldLabels);

        return array(
            'total' => count($products),
            'found' => $found,
            'new_count' => $newCount,
            'products' => $products,
            'field_labels' => $fieldLabels,
            'update_field_labels' => $updateFieldLabels,
            'create_field_labels' => $createFieldLabels,
            'ai_fields' => $aiFields,
        );
    }

    public static function executeUpdate($allRows, $mapping, $offset = 0, $limit = 25, $headers = array(), $configVars = array(), $aiData = array(), $manualData = array())
    {
        $skuIndex = isset($mapping['sku']) && $mapping['sku'] !== '' ? intval($mapping['sku']) : -1;

        if ($skuIndex < 0) {
            return new WP_Error('missing_sku', 'Debe seleccionar la columna SKU');
        }

        // Split mapping: update fields for existing, create fields for new
        $updateMapping = array();
        $createMapping = array();
        foreach ($mapping as $key => $colIndex) {
            if ($key === 'sku' || $colIndex === '') {
                continue;
            }
            if (strpos($key, 'create_') === 0) {
                $realKey = substr($key, 7);
                if (isset(self::$fields[$realKey])) {
                    if ($colIndex === '__ai__') {
                        $createMapping[$realKey] = '__ai__';
                    } elseif ($colIndex === '__manual__') {
                        $createMapping[$realKey] = '__manual__';
                    } elseif (is_string($colIndex) && strpos($colIndex, 'custom:') === 0) {
                        $createMapping[$realKey] = $colIndex;
                    } elseif (is_string($colIndex) && strpos($colIndex, 'calc:') === 0) {
                        $createMapping[$realKey] = $colIndex;
                    } else {
                        $createMapping[$realKey] = intval($colIndex);
                    }
                }
            } elseif (isset(self::$fields[$key])) {
                if (is_string($colIndex) && strpos($colIndex, 'calc:') === 0) {
                    $updateMapping[$key] = $colIndex;
                } else {
                    $updateMapping[$key] = intval($colIndex);
                }
                $createMapping[$key] = intval($colIndex);
            }
        }

        $creationBrand = isset($mapping['creation_brand']) ? sanitize_text_field($mapping['creation_brand']) : '';
        $creationCategory = isset($mapping['creation_category']) ? sanitize_text_field($mapping['creation_category']) : '';
        $conditions = isset($mapping['conditions']) ? $mapping['conditions'] : array();

        $brandManual = ($creationBrand === '__manual__');
        $categoryManual = ($creationCategory === '__manual__');
        if ($brandManual) $creationBrand = '';
        if ($categoryManual) $creationCategory = '';

        $autoManualEmpty = isset($mapping['auto_manual_empty']) && $mapping['auto_manual_empty'] === '1';

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
                // Use appropriate mapping per product type
                $activeMapping = $isNew ? $createMapping : $updateMapping;

                foreach ($activeMapping as $field => $colIndex) {
                    $value = '';
                    if ($colIndex === '__ai__') {
                        $value = isset($aiData[$sku][$field]) ? $aiData[$sku][$field] : '';
                    } elseif ($colIndex === '__manual__') {
                        $value = isset($manualData[$sku][$field]) ? $manualData[$sku][$field] : '';
                    } elseif (is_string($colIndex) && strpos($colIndex, 'custom:') === 0) {
                        $template = substr($colIndex, 7);
                        $value = self::resolveTemplate($template, $row, $headers, $configVars);
                    } elseif (is_string($colIndex) && strpos($colIndex, 'calc:') === 0) {
                        $expr = substr($colIndex, 5);
                        $value = self::resolveCalc($expr, $row, $headers, $configVars);
                    } else {
                        $value = isset($row[$colIndex]) ? $row[$colIndex] : '';
                    }
                    // Auto-manual override: use manual data for empty values
                    if ($autoManualEmpty && empty($value) && isset($manualData[$sku][$field])) {
                        $value = $manualData[$sku][$field];
                    }
                    if ($value !== '') {
                        self::setProductField($product, $field, $value, self::$fields[$field]['type']);
                    }
                }

                // Determine effective brand and category values (unconditional, conditional, or manual)
                $effectiveBrand = $creationBrand;
                $effectiveCategory = $creationCategory;

                // Manual brand/category override
                if ($brandManual && isset($manualData[$sku]['__brand__'])) {
                    $effectiveBrand = sanitize_text_field($manualData[$sku]['__brand__']);
                } elseif ($autoManualEmpty && empty($effectiveBrand) && isset($manualData[$sku]['__brand__'])) {
                    $effectiveBrand = sanitize_text_field($manualData[$sku]['__brand__']);
                }
                if ($categoryManual && isset($manualData[$sku]['__category__'])) {
                    $effectiveCategory = sanitize_text_field($manualData[$sku]['__category__']);
                } elseif ($autoManualEmpty && empty($effectiveCategory) && isset($manualData[$sku]['__category__'])) {
                    $effectiveCategory = sanitize_text_field($manualData[$sku]['__category__']);
                }

                if ($isNew) {
                    // Check conditional brand
                    if (isset($conditions['marca'])) {
                        $condList = $conditions['marca'];
                        if (isset($condList['column'])) {
                            $condList = array($condList);
                        }
                        foreach ($condList as $cond) {
                            if (self::evaluateCondition($cond, $row)) {
                                $effectiveBrand = isset($cond['apply']) ? sanitize_text_field($cond['apply']) : '';
                                break;
                            }
                            $effectiveBrand = '';
                        }
                    }
                    if (!empty($effectiveBrand)) {
                        $attrs = $product->get_attributes();
                        if (!is_array($attrs)) {
                            $attrs = array();
                        }
                        $attrs['brand'] = array(
                            'name' => 'Brand',
                            'value' => $effectiveBrand,
                            'position' => 0,
                            'is_visible' => 1,
                            'is_variation' => 0,
                            'is_taxonomy' => 0,
                        );
                        $product->set_attributes($attrs);
                    }
                }

                $product->save();

                if ($isNew) {
                    // Check conditional category (after save to have product ID)
                    if (isset($conditions['categoria'])) {
                        $condList = $conditions['categoria'];
                        if (isset($condList['column'])) {
                            $condList = array($condList);
                        }
                        foreach ($condList as $cond) {
                            if (self::evaluateCondition($cond, $row)) {
                                $effectiveCategory = isset($cond['apply']) ? sanitize_text_field($cond['apply']) : '';
                                break;
                            }
                            $effectiveCategory = '';
                        }
                    }
                    if (!empty($effectiveCategory)) {
                        $catTerm = get_term_by('name', $effectiveCategory, 'product_cat');
                        if (!$catTerm) {
                            $catTerm = get_term_by('slug', $effectiveCategory, 'product_cat');
                        }
                        if ($catTerm) {
                            wp_set_object_terms($product->get_id(), array(intval($catTerm->term_id)), 'product_cat', true);
                        }
                    }
                }

                // Process attributes
                if ($isNew && isset($mapping['attributes'])) {
                    $attrList = $mapping['attributes'];
                    if (is_array($attrList) && isset($attrList[0])) {
                        foreach ($attrList as $attrItem) {
                            $taxonomyName = isset($attrItem['taxonomy']) ? sanitize_text_field($attrItem['taxonomy']) : '';
                            $termName = isset($attrItem['term']) ? sanitize_text_field($attrItem['term']) : '';
                            $attrConditions = isset($attrItem['conditions']) ? $attrItem['conditions'] : null;
                            if (empty($taxonomyName)) {
                                continue;
                            }
                            // If conditions exist, use first matching condition's apply as term
                            if (!empty($attrConditions) && is_array($attrConditions)) {
                                $matchedTerm = '';
                                foreach ($attrConditions as $cond) {
                                    if (self::evaluateCondition($cond, $row)) {
                                        $matchedTerm = isset($cond['apply']) ? sanitize_text_field($cond['apply']) : '';
                                        break;
                                    }
                                }
                                if (empty($matchedTerm)) {
                                    continue;
                                }
                                $termName = $matchedTerm;
                            } elseif (empty($termName)) {
                                continue;
                            }
                            $fullTaxonomy = 'pa_' . $taxonomyName;
                            if (taxonomy_exists($fullTaxonomy)) {
                                $term = get_term_by('name', $termName, $fullTaxonomy);
                                if (!$term) {
                                    $term = get_term_by('slug', $termName, $fullTaxonomy);
                                }
                                if ($term) {
                                    wp_set_object_terms($product->get_id(), array(intval($term->term_id)), $fullTaxonomy, true);
                                }
                            }
                        }
                    }
                }

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

    $headers = isset($cached['headers']) ? $cached['headers'] : array();
    $configVars = isset($mapping['config_vars']) ? $mapping['config_vars'] : array();
    $aiData = isset($_POST['ai_data']) ? $_POST['ai_data'] : array();
    $manualData = isset($_POST['manual_data']) ? $_POST['manual_data'] : array();
    $result = CDEP_PRODUCTS::validateMapping($cached['all_rows'], $mapping, $headers, $configVars, $aiData, $manualData);

    if (is_wp_error($result)) {
        wp_send_json_error($result->get_error_message());
    }

    $result['file_name'] = $selected['file_name'];

    wp_send_json_success($result);
});

add_action('wp_ajax_cdep_ai_generate', function () {
    if (!current_user_can('manage_options')) {
        wp_send_json_error('Unauthorized');
    }
    check_ajax_referer('cdep_nonce', 'nonce');

    if (!defined('IACON_KEY')) {
        wp_send_json_error('IA Conector no está activo');
    }

    $mapping = isset($_POST['mapping']) ? $_POST['mapping'] : array();
    $skus = isset($_POST['skus']) ? $_POST['skus'] : array();
    $aiProvider = sanitize_text_field($_POST['ai_provider'] ?? '');

    if (empty($skus) || !is_array($skus)) {
        wp_send_json_error('No se recibieron SKUs');
    }

    if (empty($aiProvider)) {
        wp_send_json_error('No se ha seleccionado un proveedor de IA');
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

    $headers = isset($cached['headers']) ? $cached['headers'] : array();
    $configVars = isset($mapping['config_vars']) ? $mapping['config_vars'] : array();
    $creationBrand = isset($mapping['creation_brand']) ? $mapping['creation_brand'] : '';
    $allRows = $cached['all_rows'];

    // Build create mapping to know which fields are __ai__ and extract extra prompts
    $createMapping = array();
    $extraPrompts = array();
    foreach ($mapping as $key => $colIndex) {
        if ($key === 'sku' || $colIndex === '') {
            continue;
        }
        if (strpos($key, 'create_') === 0) {
            // Detect extra prompts (keys ending with _prompt)
            $suffix = substr($key, 7);
            $promptPos = strrpos($suffix, '_prompt');
            if ($promptPos !== false && $promptPos === strlen($suffix) - 7) {
                $fieldKey = substr($suffix, 0, $promptPos);
                $extraPrompts[$fieldKey] = $colIndex;
                continue;
            }
            $realKey = $suffix;
            $createMapping[$realKey] = $colIndex;
        }
    }

    // Collect AI fields
    $aiFields = array();
    foreach ($createMapping as $field => $colIndex) {
        if ($colIndex === '__ai__') {
            $aiFields[] = $field;
        }
    }

    if (empty($aiFields)) {
        wp_send_json_error('No hay campos configurados para generar con IA');
    }

    $fieldLabels = CDEP_PRODUCTS::getFields();
    $aiData = array();

    foreach ($allRows as $row) {
        $sku = isset($row[$skuIndex]) ? trim($row[$skuIndex]) : '';
        if (empty($sku) || !in_array($sku, $skus)) {
            continue;
        }

        // Build context for each AI field
        foreach ($aiFields as $field) {
            // Build prompt with product context
            $contextParts = array();
            $contextParts[] = 'SKU: ' . $sku;

            if ($creationBrand) {
                $contextParts[] = 'Marca: ' . $creationBrand;
            }

            foreach ($configVars as $varName => $varValue) {
                $contextParts[] = $varName . ': ' . $varValue;
            }

            // Include other column values for context
            foreach ($headers as $h) {
                $idx = intval($h['index']);
                $val = isset($row[$idx]) ? trim($row[$idx]) : '';
                if ($val !== '') {
                    $contextParts[] = $h['name'] . ': ' . $val;
                }
            }

            $context = implode("\n", $contextParts);
            $fieldLabel = isset($fieldLabels[$field]) ? $fieldLabels[$field]['label'] : $field;

            // Build prompt
            if ($field === 'product_name') {
                $prompt = "Genera SOLO el nombre del producto, descriptivo y atractivo. Máximo 100 caracteres. Sin HTML. Ejemplo: Bolso Michael Kors Once Original\n\nDatos:\n" . $context . "\n";
            } elseif ($field === 'short_description') {
                $prompt = "Escribe UNA SOLA FRASE persuasiva de máximo 200 caracteres describiendo el producto. Sin HTML, sin títulos, sin etiquetas. Texto plano.\n\nDatos del producto:\n" . $context . "\n";
                } elseif ($field === 'description') {
                    $prompt = "Escribe una descripción completa del producto con 3-4 secciones. Usa <h2> para títulos de sección y <p> para párrafos. Describe materiales, diseño, características y beneficios.\n\nDatos del producto:\n" . $context . "\n";
            }

            // Append extra prompt if provided (with variable resolution)
            if (isset($extraPrompts[$field]) && !empty($extraPrompts[$field])) {
                $resolvedExtra = CDEP_PRODUCTS::resolveTemplate(
                    sanitize_textarea_field($extraPrompts[$field]),
                    $row,
                    $headers,
                    $configVars
                );
                $prompt .= "\n\nInstrucciones adicionales del usuario:\n" . $resolvedExtra;
            }

            $response = array('status' => 'error', 'data' => '');

            try {
                if ($aiProvider === 'gemini' && class_exists('IACON_AI')) {
                    $response = IACON_AI::sendPrompt($prompt);
                } elseif ($aiProvider === 'kodee' && class_exists('IACON_KODEE')) {
                    $kodeeConfig = array();
                    if ($field === 'short_description') {
                        $kodeeConfig = array('length' => '50-200');
                    } elseif ($field === 'product_name') {
                        $kodeeConfig = array('length' => '10-100');
                    } elseif ($field === 'description') {
                        $kodeeConfig = array('length' => '400-800');
                    }
                    $response = IACON_KODEE::sendPrompt($prompt, $kodeeConfig);
                }
            } catch (Exception $e) {
                $response = array('status' => 'error', 'message' => $e->getMessage());
            }

            if ($response['status'] === 'ok') {
                $content = $response['data'];
                // Post-process Kodee output (always returns blog_post format)
                if ($field === 'short_description') {
                    $content = strip_tags($content);
                    $content = preg_replace('/\s+/', ' ', $content);
                    $content = trim($content);
                    if (strlen($content) > 200) {
                        $content = substr($content, 0, 197) . '...';
                    }
                } elseif ($field === 'product_name') {
                    $content = strip_tags($content);
                    $content = trim(preg_replace('/\s+/', ' ', $content));
                    if (strlen($content) > 100) {
                        $content = substr($content, 0, 97) . '...';
                    }
                } elseif ($field === 'description') {
                    $content = trim($content);
                }
                $aiData[$sku][$field] = $content;
            } else {
                $aiData[$sku][$field] = '';
                $errorMsg = isset($response['message']) ? $response['message'] : 'Error desconocido al generar con IA';
            }
        }
    }

    wp_send_json_success(array(
        'data' => $aiData,
    ));
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

    $headers = isset($cached['headers']) ? $cached['headers'] : array();
    $configVars = isset($mapping['config_vars']) ? $mapping['config_vars'] : array();
    $manualData = isset($_POST['manual_data']) ? $_POST['manual_data'] : array();
    $result = CDEP_PRODUCTS::executeUpdate($cached['all_rows'], $mapping, $offset, $limit, $headers, $configVars, array(), $manualData);

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

    $headers = isset($cached['headers']) ? $cached['headers'] : array();
    $configVars = isset($mapping['config_vars']) ? $mapping['config_vars'] : array();
    $aiData = isset($_POST['ai_data']) ? $_POST['ai_data'] : array();
    $manualData = isset($_POST['manual_data']) ? $_POST['manual_data'] : array();
    $result = CDEP_PRODUCTS::executeUpdate($rowsToProcess, $mapping, 0, count($rowsToProcess), $headers, $configVars, $aiData, $manualData);

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

    $headers = isset($cached['headers']) ? $cached['headers'] : array();
    $configVars = isset($mapping['config_vars']) ? $mapping['config_vars'] : array();
    $aiData = isset($_POST['ai_data']) ? $_POST['ai_data'] : array();
    $manualData = isset($_POST['manual_data']) ? $_POST['manual_data'] : array();
    $result = CDEP_PRODUCTS::executeUpdate(array($foundRow), $mapping, 0, 1, $headers, $configVars, $aiData, $manualData);

    if (is_wp_error($result)) {
        wp_send_json_error($result->get_error_message());
    }

    wp_send_json_success($result);
});
