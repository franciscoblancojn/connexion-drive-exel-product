<?php
defined('ABSPATH') || exit;
$isConnected ??= false;
if (!$isConnected): ?>
    <div class="cdep-section">
        <p class="cdep-notice">Primero debes conectarte a Google Drive en la pestaña "Conectar".</p>
    </div>
<?php return;
endif;

if (empty($selected)): ?>
    <div class="cdep-section">
        <p class="cdep-notice">Primero debes seleccionar un archivo Excel en la pestaña "Explorar".</p>
    </div>
<?php return;
endif;

$productFields = CDEP_PRODUCTS::getFields();
?>
<div class="cdep-section">
    <h2>Mapeo de Columnas</h2>

    <div class="cdep-card">
        <p>Archivo seleccionado: <strong><?= esc_html($selected['file_name'] ?? '') ?></strong></p>

        <div id="cdep-mapping-container">
            <p class="cdep-loading">Cargando datos del archivo...</p>
        </div>

        <div id="cdep-mapping-form" style="display:none">
            <table class="form-table">
                <tr>
                    <th><label for="cdep-header-row">Fila de encabezados</label></th>
                    <td>
                        <input type="number" id="cdep-header-row" class="small-text" value="0" min="0">
                        <button id="cdep-apply-header-row" class="button">Aplicar</button>
                        <p class="description">Número de fila que contiene los nombres de columna (0 = primera fila)</p>
                    </td>
                </tr>
                <tr>
                    <th><label for="mapping-sku">Columna SKU <span style="color:#d63638">*</span></label></th>
                    <td>
                        <select id="mapping-sku" class="cdep-mapping-select">
                            <option value="">— Seleccionar columna SKU —</option>
                        </select>
                        <p class="description">Columna que contiene el SKU del producto (obligatorio)</p>
                    </td>
                </tr>
            </table>

            <h3>Productos existentes — Actualización</h3>
            <p class="description">Selecciona columnas para actualizar productos que ya existen en WooCommerce. Solo se actualizarán precio y stock.</p>

            <table class="wp-list-table widefat striped" id="cdep-field-mapping-update">
                <thead>
                    <tr>
                        <th style="width:40%">Campo del producto</th>
                        <th style="width:60%">Columna en el archivo</th>
                    </tr>
                </thead>
                <tbody>
                    <?php
                    $updateFields = array('regular_price', 'sale_price', 'stock_quantity');
                    foreach ($updateFields as $fieldKey):
                        $fieldInfo = $productFields[$fieldKey];
                    ?>
                    <tr>
                        <td><strong><?= esc_html($fieldInfo['label']) ?></strong></td>
                        <td>
                            <select class="cdep-field-select" data-field="<?= esc_attr($fieldKey) ?>" style="width:100%;max-width:400px">
                                <option value="">— No mapear —</option>
                            </select>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>

            <div class="cdep-two-columns">
                <div class="cdep-two-columns-left">
                    <h3>Productos nuevos — Creación</h3>
                    <p class="description">Selecciona columnas para crear nuevos productos en WooCommerce. Todos los campos están disponibles.</p>

                    <table class="wp-list-table widefat striped" id="cdep-field-mapping-create">
                        <thead>
                            <tr>
                                <th style="width:40%">Campo del producto</th>
                                <th style="width:60%">Columna en el archivo</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($productFields as $fieldKey => $fieldInfo): ?>
                            <tr>
                                <td><strong><?= esc_html($fieldInfo['label']) ?></strong></td>
                                <td>
                                    <select class="cdep-field-select-create" data-field="<?= esc_attr($fieldKey) ?>" style="width:100%;max-width:400px">
                                        <option value="">— No mapear —</option>
                                        <option value="__custom__">Personalizar</option>
                                        <option value="__ai__">Generar con IA</option>
                                    </select>
                                    <div class="cdep-custom-template-wrap" style="display:none;margin-top:4px">
                                        <div class="cdep-template-input-row">
                                            <input type="text" class="cdep-custom-template-input" placeholder="Ej: {nombre} - {tipo}" style="width:100%">
                                            <button type="button" class="cdep-template-variable-btn button button-small" title="Insertar variable">+</button>
                                        </div>
                                        <div class="cdep-template-variables-list" style="display:none"></div>
                                    </div>
                                </td>
                            </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
                <div class="cdep-two-columns-right">
                    <h3>Configuraciones de Creación</h3>
                    <p class="description">Configuraciones que se aplicarán a todos los productos nuevos creados.</p>
                    <table class="wp-list-table widefat striped" id="cdep-creation-config-table">
                        <thead>
                            <tr>
                                <th>Configuración</th>
                                <th>Valor</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td><strong>Marca</strong></td>
                                <td>
                                    <select id="creation-brand" class="cdep-config-main-select cdep-config-condicionable" style="width:100%">
                                        <option value="">— Sin marca —</option>
                                        <option value="__condicionar__">Condicionar</option>
                                        <?php
                                        $brandTerms = taxonomy_exists('product_brand') ? get_terms(array(
                                            'taxonomy' => 'product_brand',
                                            'hide_empty' => false,
                                        )) : array();
                                        if (!empty($brandTerms) && !is_wp_error($brandTerms)):
                                            foreach ($brandTerms as $term):
                                        ?>
                                        <option value="<?= esc_attr($term->name) ?>"><?= esc_html($term->name) ?></option>
                                        <?php
                                            endforeach;
                                        endif;
                                        ?>
                                    </select>
                                    <p class="description">Marca que se asignará a todos los productos nuevos. Selecciona "Condicionar" para aplicar según condiciones.</p>
                                    <div class="cdep-condition-row" data-condition="marca" style="display:none;margin-top:6px">
                                        <div class="cdep-condition-items"></div>
                                        <button type="button" class="button button-small cdep-condition-add">+ Agregar otra condición</button>
                                        <p class="description" style="margin-top:4px">Cada condición evaluada en orden. Primera coincidencia aplica.</p>
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <td><strong>Categoría</strong></td>
                                <td>
                                    <select id="creation-category" class="cdep-config-main-select cdep-config-condicionable" style="width:100%">
                                        <option value="">— Sin categoría —</option>
                                        <option value="__condicionar__">Condicionar</option>
                                        <?php
                                        $catTerms = taxonomy_exists('product_cat') ? get_terms(array(
                                            'taxonomy' => 'product_cat',
                                            'hide_empty' => false,
                                        )) : array();
                                        if (!empty($catTerms) && !is_wp_error($catTerms)):
                                            foreach ($catTerms as $term):
                                        ?>
                                        <option value="<?= esc_attr($term->name) ?>"><?= esc_html($term->name) ?></option>
                                        <?php
                                            endforeach;
                                        endif;
                                        ?>
                                    </select>
                                    <p class="description">Categoría que se asignará a todos los productos nuevos. Selecciona "Condicionar" para aplicar según condiciones.</p>
                                    <div class="cdep-condition-row" data-condition="categoria" style="display:none;margin-top:6px">
                                        <div class="cdep-condition-items"></div>
                                        <button type="button" class="button button-small cdep-condition-add">+ Agregar otra condición</button>
                                        <p class="description" style="margin-top:4px">Cada condición evaluada en orden. Primera coincidencia aplica.</p>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <p>
                <button id="cdep-preview-update" class="button button-primary">
                    Vista Previa de Actualización
                </button>
                <button id="cdep-refresh-file" class="button">
                    Actualizar Archivo
                </button>
            </p>

            <div id="cdep-preview-result"></div>
        </div>
    </div>
</div>
