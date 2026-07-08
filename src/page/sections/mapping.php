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
                    <th><label for="cdep-decimal-char">Caracter de decimales</label></th>
                    <td>
                        <select id="cdep-decimal-char">
                            <option value="," selected>Coma (,) — formato Latino</option>
                            <option value=".">Punto (.) — formato US</option>
                        </select>
                        <p class="description">Define cómo se interpretan los números en cálculos. Ej: "1.234,56" con Coma = 1234.56, con Punto = 1.234</p>
                    </td>
                </tr>
                <tr id="cdep-delimiter-row">
                    <th><label for="cdep-delimiter">Delimitador CSV</label></th>
                    <td>
                        <select id="cdep-delimiter" class="cdep-delimiter-select">
                            <option value="auto">Auto-detectar</option>
                            <option value=",">Coma (,)</option>
                            <option value=";">Punto y coma (;)</option>
                            <option value="TAB">Tabulación (TAB)</option>
                        </select>
                        <p class="description">Delimitador usado en el archivo CSV. "Auto-detectar" intenta detectarlo automáticamente.</p>
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
            <p class="description">Selecciona columnas para actualizar productos que ya existen en WooCommerce.</p>

            <table class="wp-list-table widefat striped" id="cdep-field-mapping-update">
                <thead>
                    <tr>
                        <th style="width:40%">Campo del producto</th>
                        <th style="width:60%">Columna en el archivo</th>
                    </tr>
                </thead>
                <tbody>
                    <?php
                    $updateFields = array('regular_price', 'sale_price', 'stock_quantity', 'description', 'short_description', 'product_name');
                    $aiUpdateFields = array('description', 'short_description', 'product_name');
                    foreach ($updateFields as $fieldKey):
                        $fieldInfo = $productFields[$fieldKey];
                        $hasAi = in_array($fieldKey, $aiUpdateFields);
                    ?>
                    <tr>
                        <td><strong><?= esc_html($fieldInfo['label']) ?></strong></td>
                        <td>
                             <select class="cdep-field-select" data-field="<?= esc_attr($fieldKey) ?>" style="width:100%;max-width:400px">
                                 <option value="">— No mapear —</option>
                                 <option value="__custom__">Personalizar</option>
                                 <option value="__calc__">Cálculo</option>
                                 <option value="__manual__">Edición Manual</option>
                                 <?php if ($hasAi): ?>
                                 <option value="__ai__">Generar con IA</option>
                                 <?php endif; ?>
                             </select>
                            <div class="cdep-custom-template-wrap" style="display:none;margin-top:4px">
                                <div class="cdep-template-input-row">
                                    <input type="text" class="cdep-custom-template-input" placeholder="Ej: {nombre} - {tipo}" style="width:100%">
                                    <button type="button" class="cdep-template-variable-btn button button-small" title="Insertar variable">+</button>
                                </div>
                                <div class="cdep-template-variables-list" style="display:none"></div>
                            </div>
                            <div class="cdep-calc-wrap" style="display:none;margin-top:4px">
                                <div class="cdep-template-input-row">
                                    <input type="text" class="cdep-calc-input" placeholder="Ej: {columna} * 1.19" style="width:100%">
                                    <button type="button" class="cdep-template-variable-btn button button-small" title="Insertar variable">+</button>
                                </div>
                                <div class="cdep-template-variables-list" style="display:none"></div>
                            </div>
                            <?php if ($hasAi): ?>
                            <div class="cdep-ai-prompt-wrap" style="display:none;margin-top:4px">
                                <div class="cdep-template-input-row">
                                    <textarea class="cdep-ai-prompt-input" placeholder="Prompt extra para la IA..." style="width:100%;min-height:50px"></textarea>
                                    <button type="button" class="cdep-template-variable-btn button button-small" title="Insertar variable">+</button>
                                </div>
                                <div class="cdep-template-variables-list" style="display:none"></div>
                            </div>
                            <?php endif; ?>
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
                                        <option value="__calc__">Cálculo</option>
                                        <option value="__manual__">Edición Manual</option>
                                        <option value="__ai__">Generar con IA</option>
                                    </select>
                                    <div class="cdep-custom-template-wrap" style="display:none;margin-top:4px">
                                        <div class="cdep-template-input-row">
                                            <input type="text" class="cdep-custom-template-input" placeholder="Ej: {nombre} - {tipo}" style="width:100%">
                                            <button type="button" class="cdep-template-variable-btn button button-small" title="Insertar variable">+</button>
                                        </div>
                                        <div class="cdep-template-variables-list" style="display:none"></div>
                                    </div>
                                    <div class="cdep-calc-wrap" style="display:none;margin-top:4px">
                                        <div class="cdep-template-input-row">
                                            <input type="text" class="cdep-calc-input" placeholder="Ej: {columna} * 10 + 5" style="width:100%">
                                            <button type="button" class="cdep-template-variable-btn button button-small" title="Insertar variable">+</button>
                                        </div>
                                        <div class="cdep-template-variables-list" style="display:none"></div>
                                    </div>
                                    <div class="cdep-ai-prompt-wrap" style="display:none;margin-top:4px">
                                        <div class="cdep-template-input-row">
                                            <textarea class="cdep-ai-prompt-input" placeholder="Prompt extra para la IA..." style="width:100%;min-height:50px"></textarea>
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
                                        <option value="__manual__">Edición Manual</option>
                                        <?php
                                        $brandTerms = taxonomy_exists('product_brand') ? get_terms(array(
                                            'taxonomy' => 'product_brand',
                                            'hide_empty' => false,
                                        )) : array();
                                        if (!empty($brandTerms) && !is_wp_error($brandTerms)):
                                            foreach ($brandTerms as $term):
                                        ?>
                                        <option value="<?= esc_attr($term->slug) ?>"><?= esc_html($term->name) ?></option>
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
                                    <div id="cdep-categories-container">
                                        <div class="cdep-category-item">
                                            <select class="cdep-config-main-select cdep-category-select cdep-config-condicionable" style="width:100%">
                                                <option value="">— Sin categoría —</option>
                                                <option value="__condicionar__">Condicionar</option>
                                                <option value="__manual__">Edición Manual</option>
                                                <?php
                                                $catTerms = taxonomy_exists('product_cat') ? get_terms(array(
                                                    'taxonomy' => 'product_cat',
                                                    'hide_empty' => false,
                                                )) : array();
                                                if (!empty($catTerms) && !is_wp_error($catTerms)):
                                                    $termMap = array();
                                                    foreach ($catTerms as $t) {
                                                        $termMap[$t->term_id] = $t;
                                                    }
                                                    foreach ($catTerms as $term):
                                                        $displayName = $term->name;
                                                        $parentId = $term->parent;
                                                        if ($parentId && isset($termMap[$parentId])) {
                                                            $path = array($term->name);
                                                            while ($parentId && isset($termMap[$parentId])) {
                                                                array_unshift($path, $termMap[$parentId]->name);
                                                                $parentId = $termMap[$parentId]->parent;
                                                            }
                                                            $displayName = implode(' > ', $path);
                                                        }
                                                ?>
                                                <option value="<?= esc_attr($term->slug) ?>"><?= esc_html($displayName) ?></option>
                                                <?php
                                                    endforeach;
                                                endif;
                                                ?>
                                            </select>
                                            <button type="button" class="button button-small cdep-category-remove" style="display:none">×</button>
                                        </div>
                                    </div>
                                    <button type="button" class="button button-small cdep-category-add" style="margin-top:4px">+ Agregar categoría</button>
                                    <p class="description">Categorías que se asignarán a todos los productos nuevos. Selecciona "Condicionar" para aplicar según condiciones.</p>
                                    <div class="cdep-condition-row" data-condition="categoria" style="display:none;margin-top:6px">
                                        <div class="cdep-condition-items"></div>
                                        <button type="button" class="button button-small cdep-condition-add">+ Agregar otra condición</button>
                                        <p class="description" style="margin-top:4px">Cada condición evaluada en orden. Primera coincidencia aplica.</p>
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <td><strong>Atributos</strong></td>
                                <td>
                                    <div id="cdep-attributes-container" style="margin-bottom:6px"></div>
                                    <button type="button" class="button button-small cdep-attribute-add">+ Agregar atributo</button>
                                    <p class="description">Atributos que se asignarán a todos los productos nuevos. Cada atributo puede tener condiciones.</p>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <p>
                <label>
                    <input type="checkbox" id="cdep-auto-manual-empty" checked>
                    En caso de no tener valor, activar edición manual
                </label>
            </p>

            <p>
                <button id="cdep-preview-update" class="button button-primary">
                    Vista Previa de Actualización
                </button>
                <button id="cdep-refresh-file" class="button">
                    Actualizar Archivo
                </button>
            </p>

            <div id="cdep-preview-result"></div>

            <div class="cdep-export-import" style="margin-top:20px;padding-top:15px;border-top:1px solid #ccd0d4">
                <h3>Exportar / Importar Configuración</h3>
                <p class="description">Exporta toda la configuración de mapeo, edición manual y contenido generado con IA para usarla en otro navegador o sesión.</p>
                <p>
                    <button id="cdep-export-config" class="button">Exportar Configuración</button>
                    <button id="cdep-import-config" class="button">Importar Configuración</button>
                    <input type="file" id="cdep-import-file" accept=".json" style="display:none">
                </p>
            </div>
        </div>
    </div>
</div>
