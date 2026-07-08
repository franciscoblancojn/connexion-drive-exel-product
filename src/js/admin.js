jQuery(function ($) {
    const imageProductDefualt = `<img src="https://woocommerce.aveonline.co/wp-content/uploads/woocommerce-placeholder-150x150.png" width="40" height="40" style="object-fit:cover;border-radius:4px">`
    var state = {
        currentFolder: 'root',
        folderHistory: [],
        headers: [],
        mapping: {},
        totalRows: 0,
        selectedFileId: '',
        aiGenerated: {},
        manualData: {},
    };
    var cdep = window.cdep;

    function ajax(action, data, success, error) {
        $.ajax({
            url: cdep.ajaxurl,
            type: 'POST',
            data: $.extend({
                action: action,
                nonce: cdep.nonce,
            }, data),
            success: function (resp) {
                if (resp.success) {
                    if (success) success(resp.data);
                } else {
                    if (error) error(resp.data);
                    else showMessage('#cdep-config-message', resp.data, 'error');
                }
            },
            error: function () {
                if (error) error('Error de conexión');
                else showMessage('#cdep-config-message', 'Error de conexión', 'error');
            },
        });
    }

    function showMessage(selector, msg, type) {
        var el = $(selector);
        if (typeof msg === 'object') msg = msg.message || JSON.stringify(msg);
        el.html('<p class="fwue-message ' + type + '">' + msg + '</p>');
        setTimeout(function () { el.empty(); }, 8000);
    }

    // === CONNECT TAB ===

    $('#cdep-config-form').on('submit', function (e) {
        e.preventDefault();
        ajax('cdep_save_config', {
            client_id: $('#client_id').val(),
            client_secret: $('#client_secret').val(),
            redirect_uri: $('#redirect_uri').val(),
        }, function (data) {
            showMessage('#cdep-config-message', data.message, 'ok');
        }, function (msg) {
            showMessage('#cdep-config-message', msg, 'error');
        });
    });

    $('#cdep-drive-connect').on('click', function () {
        ajax('cdep_get_auth_url', {}, function (data) {
            if (data.url) {
                window.location.href = data.url;
            }
        }, function (msg) {
            showMessage('#cdep-connect-message', msg, 'error');
        });
    });

    $('#cdep-drive-disconnect').on('click', function () {
        if (!confirm('¿Estás seguro de desconectar Google Drive?')) return;
        ajax('cdep_drive_disconnect', {}, function (data) {
            showMessage('#cdep-connect-message', data.message, 'ok');
            setTimeout(function () { location.reload(); }, 1500);
        }, function (msg) {
            showMessage('#cdep-connect-message', msg, 'error');
        });
    });

    // Handle OAuth callback
    (function () {
        var params = new URLSearchParams(window.location.search);
        var code = params.get('code');
        if (code) {
            showMessage('#cdep-connect-message', 'Conectando a Google Drive...', 'ok');
            ajax('cdep_drive_connect', { code: code }, function (data) {
                showMessage('#cdep-connect-message', data.message, 'ok');
                setTimeout(function () {
                    window.location.href = '?page=CDEP#tag-browse';
                }, 1500);
            }, function (msg) {
                showMessage('#cdep-connect-message', msg, 'error');
            });
        }
    })();

    // === BROWSE TAB ===

    function saveFolderState() {
        try {
            localStorage.setItem('cdep_folder', JSON.stringify({
                currentFolder: state.currentFolder,
                folderHistory: state.folderHistory,
                folderName: $('.cdep-current-folder').text(),
            }));
        } catch (e) {}
    }

    function restoreFolderState() {
        try {
            var saved = localStorage.getItem('cdep_folder');
            if (saved) {
                var data = JSON.parse(saved);
                if (data.currentFolder && data.currentFolder !== 'root') {
                    state.currentFolder = data.currentFolder;
                    state.folderHistory = data.folderHistory || [];
                    if (data.currentFolder === 'shared') {
                        $('.cdep-breadcrumb-sub').addClass('visible');
                    } else if (data.folderName) {
                        $('.cdep-current-folder').text(data.folderName);
                        $('.cdep-breadcrumb-sub').addClass('visible');
                    }
                    return true;
                }
            }
        } catch (e) {}
        return false;
    }

    function clearFolderState() {
        try {
            localStorage.removeItem('cdep_folder');
        } catch (e) {}
    }

    function loadFiles(folderId, pageToken) {
        state.currentFolder = folderId;
        $('#cdep-file-list').html('<p class="cdep-loading">Cargando archivos...</p>');

        ajax('cdep_drive_list', {
            folder_id: folderId,
            page_token: pageToken || '',
        }, function (data) {
            var html = '';
            var filtered = [];
            $.each(data.files, function (i, file) {
                var isFolder = file.mimeType === 'application/vnd.google-apps.folder';
                var isSpreadsheet = file.mimeType === 'application/vnd.google-apps.spreadsheet'
                    || file.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                    || file.mimeType === 'application/vnd.ms-excel'
                    || file.name.match(/\.(xlsx|xls|csv)$/i);
                if (isFolder || isSpreadsheet) {
                    file._isFolder = isFolder;
                    file._isSpreadsheet = isSpreadsheet;
                    filtered.push(file);
                }
            });
            filtered.sort(function (a, b) {
                if (a._isFolder && !b._isFolder) return -1;
                if (!a._isFolder && b._isFolder) return 1;
                return a.name.localeCompare(b.name);
            });
            if (filtered.length === 0) {
                html = '<p class="cdep-empty">Esta carpeta está vacía</p>';
            } else {
                html = '<table class="wp-list-table widefat fixed striped">';
                html += '<thead><tr><th>Nombre</th><th>Tipo</th><th>Tamaño</th><th>Acción</th></tr></thead><tbody>';
                $.each(filtered, function (i, file) {
                    var icon = file._isFolder ? '📁' : '📊';
                    var size = file.size ? formatSize(parseInt(file.size)) : '-';
                    var typeLabel = file._isFolder ? 'Carpeta' : (file.mimeType === 'application/vnd.google-apps.spreadsheet' ? 'Google Sheets' : 'Excel');

                    html += '<tr class="' + (file._isFolder ? 'cdep-folder-row' : '') + '" data-folder="' + (file._isFolder ? file.id : '') + '">';
                    html += '<td class="cdep-folder-name">' + icon + ' ' + escHtml(file.name) + '</td>';
                    html += '<td>' + typeLabel + '</td>';
                    html += '<td>' + size + '</td>';
                    html += '<td>';
                    if (file._isFolder) {
                        html += '<a href="#" class="button button-small cdep-folder-link" data-folder="' + file.id + '">Abrir</a>';
                    } else {
                        html += '<a href="#" class="button button-primary button-small cdep-select-file" data-fileid="' + file.id + '" data-filename="' + escHtml(file.name) + '" data-mimetype="' + file.mimeType + '">Seleccionar</a>';
                    }
                    html += '</td></tr>';
                });
                html += '</tbody></table>';
            }
            $('#cdep-file-list').html(html);
            saveFolderState();
        }, function (msg) {
            $('#cdep-file-list').html('<p class="cdep-error">' + msg + '</p>');
        });
    }

    function formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    }

    function escHtml(str) {
        return $('<span>').text(str).html();
    }

    $(document).on('click', '.cdep-folder-link', function (e) {
        e.preventDefault();
        var folderId = $(this).data('folder');
        openFolder(folderId, $(this).closest('tr').find('td:first').text().trim());
    });

    $(document).on('click', '.cdep-folder-row td.cdep-folder-name', function (e) {
        var folderId = $(this).closest('tr').data('folder');
        if (folderId) {
            openFolder(folderId, $(this).text().trim());
        }
    });

    function openFolder(folderId, folderName) {
        if (folderId === 'root' || folderId === 'shared') {
            state.folderHistory = [];
            $('.cdep-current-folder').text('');
            $('.cdep-breadcrumb-sub').removeClass('visible');
            if (folderId === 'shared') {
                $('.cdep-breadcrumb-sub').addClass('visible');
            }
            if (folderId === 'root') {
                clearFolderState();
            }
        } else {
            state.folderHistory.push(state.currentFolder);
            $('.cdep-current-folder').text(folderName);
            $('.cdep-breadcrumb-sub').addClass('visible');
        }
        loadFiles(folderId);
        $('#cdep-selected-file-info').hide();
    }

    $(document).on('click', '#cdep-refresh-cache', function (e) {
        e.preventDefault();
        var btn = $(this);
        btn.text('Actualizando...').prop('disabled', true);

        ajax('cdep_refresh_cache', {}, function (data) {
            state.headers = data.headers;
            state.totalRows = data.total_rows;
            window.cdepParsedData = data;
            clearAiCache();
            clearManualData();

            $('#cdep-selected-file-rows').text(data.total_rows);
            $('#cdep-file-list-message').html(
                '<div class="notice notice-success inline"><p>Cache actualizado: '
                + data.total_rows + ' filas</p></div>'
            );
            btn.text('Actualizar').prop('disabled', false);
        }, function (msg) {
            $('#cdep-file-list-message').html(
                '<div class="notice notice-error inline"><p>' + msg + '</p></div>'
            );
            btn.text('Actualizar').prop('disabled', false);
        });
    });

    $(document).on('click', '.cdep-select-file', function (e) {
        e.preventDefault();
        var btn = $(this);
        var fileId = btn.data('fileid');
        var fileName = btn.data('filename');

        btn.text('Cargando...').prop('disabled', true);

        ajax('cdep_drive_select_file', {
            file_id: fileId,
            file_name: fileName,
            mime_type: $(this).data('mimetype'),
            delimiter: $('#cdep-delimiter').length ? $('#cdep-delimiter').val() : 'auto',
        }, function (data) {
            state.headers = data.headers;
            state.totalRows = data.total_rows;
            state.selectedFileId = fileId;
            clearAiCache();
            clearManualData();

            $('#cdep-selected-file-name').text(fileName);
            $('#cdep-selected-file-rows').text(data.total_rows);
            $('#cdep-selected-file-info').show();
            $('#cdep-file-list-message').html(
                '<div class="notice notice-success inline"><p>Archivo cargado: ' + fileName
                + ' (' + data.total_rows + ' filas)</p></div>'
            );

            window.cdepParsedData = data;
            btn.text('Seleccionado').prop('disabled', false);
        }, function (msg) {
            $('#cdep-file-list-message').html(
                '<div class="notice notice-error inline"><p>' + msg + '</p></div>'
            );
            btn.text('Seleccionar').prop('disabled', false);
        });
    });

    if ($('#cdep-file-list').length && $('#browse').is(':visible')) {
        if (!restoreFolderState()) {
            loadFiles('root');
        } else {
            loadFiles(state.currentFolder);
        }
    }

    // === MAPPING TAB ===

    function loadMapping() {
        loadManualData();
        loadAiCache();
        if (window.cdepParsedData) {
            renderMapping(window.cdepParsedData);
            return;
        }

        ajax('cdep_get_cached_data', {}, function (data) {
            window.cdepParsedData = data;
            renderMapping(data);
        }, function (msg) {
            $('#cdep-mapping-container').html(
                '<p class="cdep-notice">Los datos del archivo no están disponibles. '
                + 'Ve a la pestaña <a href="#tag-browse">Explorar</a> '
                + 'y selecciona el archivo nuevamente.</p>'
            );
        });
    }

    function renderMapping(data) {
        $('#cdep-mapping-container').html('');

        if (data.sample && data.sample.length > 0) {
            var html = '<h3>Vista previa de datos (primeras ' + data.sample.length + ' filas)</h3>';
            html += '<div class="cdep-table-scroll"><table class="wp-list-table widefat fixed striped">';
            html += '<thead><tr>';
            $.each(data.headers, function (i, h) {
                html += '<th>' + escHtml(h.name) + '</th>';
            });
            html += '</tr></thead><tbody>';
            $.each(data.sample, function (ri, row) {
                html += '<tr>';
                $.each(data.headers, function (hi, h) {
                    html += '<td>' + escHtml(row[h.index] || '') + '</td>';
                });
                html += '</tr>';
            });
            html += '</tbody></table></div>';
            html += '<p>Total de filas: <strong>' + data.total_rows + '</strong></p>';
            $('#cdep-mapping-container').html(html);
        }

        // Populate SKU select
        var $skuSelect = $('#mapping-sku');
        $skuSelect.find('option:not(:first)').remove();
        $.each(data.headers, function (i, h) {
            $skuSelect.append('<option value="' + h.index + '">' + escHtml(h.name) + '</option>');
        });

        // Populate update field mapping selects (existing products)
        $('.cdep-field-select').each(function () {
            var $sel = $(this);
            var field = $(this).data('field');
            var baseVals = ['', '__calc__', '__manual__'];
            if (field === 'description' || field === 'short_description') {
                baseVals.push('__ai__');
            }
            $sel.find('option').each(function () {
                var v = $(this).val();
                if (v && baseVals.indexOf(v) === -1) {
                    $(this).remove();
                }
            });
            $.each(data.headers, function (i, h) {
                $sel.append('<option value="' + h.index + '">' + escHtml(h.name) + '</option>');
            });
        });

        // Populate create field mapping selects (new products)
        $('.cdep-field-select-create').each(function () {
            var $sel = $(this);
            // Keep base options: "No mapear", "Personalizar", "Edicion Manual", "Generar con IA"
            var baseVals = ['', '__custom__', '__calc__', '__manual__', '__ai__'];
            $sel.find('option').each(function () {
                var v = $(this).val();
                if (v && baseVals.indexOf(v) === -1) {
                    $(this).remove();
                }
            });
            $.each(data.headers, function (i, h) {
                $sel.append('<option value="' + h.index + '">' + escHtml(h.name) + '</option>');
            });
        });

        // Auto-select detected columns for update fields
        if (data.detected.sku !== null) {
            $('#mapping-sku').val(data.detected.sku);
        }
        if (data.detected.price !== null) {
            $('.cdep-field-select[data-field="regular_price"]').val(data.detected.price);
        }
        if (data.detected.sale_price !== null) {
            $('.cdep-field-select[data-field="sale_price"]').val(data.detected.sale_price);
        }
        if (data.detected.quantity !== null) {
            $('.cdep-field-select[data-field="stock_quantity"]').val(data.detected.quantity);
        }

        // Auto-select detected columns for create fields
        if (data.detected.price !== null) {
            $('.cdep-field-select-create[data-field="regular_price"]').val(data.detected.price);
        }
        if (data.detected.sale_price !== null) {
            $('.cdep-field-select-create[data-field="sale_price"]').val(data.detected.sale_price);
        }
        if (data.detected.quantity !== null) {
            $('.cdep-field-select-create[data-field="stock_quantity"]').val(data.detected.quantity);
        }

        if (typeof data.header_row !== 'undefined') {
            $('#cdep-header-row').val(data.header_row);
        }

        if (typeof data.delimiter !== 'undefined' && data.delimiter !== null) {
            var delimVal = data.delimiter === '' ? 'auto' : data.delimiter;
            if ($('#cdep-delimiter').length) {
                $('#cdep-delimiter').val(delimVal);
            }
        }

        // Show delimiter selector only for CSV files
        if ($('#cdep-delimiter-row').length) {
            var fileName = cdep.selected_file ? cdep.selected_file.file_name : '';
            if (fileName.toLowerCase().indexOf('.csv') !== -1) {
                $('#cdep-delimiter-row').show();
            } else {
                $('#cdep-delimiter-row').hide();
            }
        }

        $('#cdep-mapping-form').show();
        $('#cdep-preview-update').prop('disabled', false);

        populateConditionColumns();
        restoreMappingConfig();

        // Sync AI options visibility
        toggleAiOptions(cdep.ai_enabled === '1');
    }

    function buildMapping() {
        var mapping = {
            sku: $('#mapping-sku').val(),
            decimal_char: $('#cdep-decimal-char').val() || ',',
        };

        // Update fields (existing products)
        $('.cdep-field-select').each(function () {
            var field = $(this).data('field');
            var val = $(this).val();
            if (val) {
                if (val === '__custom__') {
                    var template = $(this).closest('td').find('.cdep-custom-template-input').val();
                    if (template) {
                        mapping[field] = 'custom:' + template;
                    }
                } else if (val === '__calc__') {
                    var calcExpr = $(this).closest('td').find('.cdep-calc-input').val();
                    if (calcExpr) {
                        mapping[field] = 'calc:' + calcExpr;
                    }
                } else if (val === '__manual__') {
                    mapping[field] = '__manual__';
                } else if (val === '__ai__') {
                    mapping[field] = '__ai__';
                    var extraPrompt = $(this).closest('td').find('.cdep-ai-prompt-input').val();
                    if (extraPrompt) {
                        mapping[field + '_prompt'] = extraPrompt;
                    }
                } else {
                    mapping[field] = val;
                }
            }
        });

        // Create fields (new products): all fields with create_ prefix
        $('.cdep-field-select-create').each(function () {
            var field = $(this).data('field');
            var val = $(this).val();
            if (val) {
                if (val === '__custom__') {
                    var template = $(this).closest('td').find('.cdep-custom-template-input').val();
                    if (template) {
                        mapping['create_' + field] = 'custom:' + template;
                    }
                } else if (val === '__calc__') {
                    var calcExpr = $(this).closest('td').find('.cdep-calc-input').val();
                    if (calcExpr) {
                        mapping['create_' + field] = 'calc:' + calcExpr;
                    }
                } else if (val === '__ai__') {
                    mapping['create_' + field] = '__ai__';
                    var extraPrompt = $(this).closest('td').find('.cdep-ai-prompt-input').val();
                    if (extraPrompt) {
                        mapping['create_' + field + '_prompt'] = extraPrompt;
                    }
                } else if (val === '__manual__') {
                    mapping['create_' + field] = '__manual__';
                } else {
                    mapping['create_' + field] = val;
                }
            }
        });

        // Creation config — collect values and conditions
        var configVars = {};
        var conditions = {};

        $('#cdep-creation-config-table tbody tr').each(function () {
            var label = $(this).find('td:first').text().trim().toLowerCase();
            var $input = $(this).find('.cdep-config-main-select');
            if ($input.length === 0) return;
            var selectedVal = $input.val();
            var selectedText = $input.find('option:selected').text();

            if (selectedVal === '__condicionar__') {
                // Exclude the per-extra-category-row condition blocks (.cdep-category-condition-row):
                // they live inside this same <tr> too, and would otherwise be picked up here instead
                // of the field's own shared condition row when any extra category row exists.
                var $conditionRow = $(this).find('.cdep-condition-row').not('.cdep-category-condition-row');
                var target = $conditionRow.data('condition');
                var $items = $conditionRow.find('.cdep-condition-items .cdep-condition-item');
                var condList = [];
                $items.each(function () {
                    var colVal = $(this).find('.cdep-condition-column').val();
                    var opVal = $(this).find('.cdep-condition-operator').val();
                    var condVal = $(this).find('.cdep-condition-value').val();
                    var applyVal = $(this).find('.cdep-condition-apply').val();
                    if (colVal && condVal && applyVal) {
                        condList.push({
                            column: colVal,
                            operator: opVal || '=',
                            value: condVal,
                            apply: applyVal
                        });
                    }
                });
                if (condList.length > 0) {
                    conditions[target] = condList;
                }
                // Also collect base category values when condicionar is selected
                if (label === 'categoría') {
                    var categories = [];
                    var $categorySelects = $('#cdep-categories-container .cdep-category-select');
                    $categorySelects.each(function () {
                        var v = $(this).val();
                        var t = $(this).find('option:selected').text();
                        if (v && v !== '__condicionar__' && v !== '__manual__') {
                            categories.push(t);
                        }
                    });
                    if (categories.length > 0) {
                        mapping['creation_categories'] = categories;
                        mapping['creation_category'] = categories[0];
                    }
                }
                // Do NOT add to config_vars since it's conditional
                } else if (selectedVal === '__manual__') {
                // Edicion Manual: set marker in mapping for per-row manual input
                if (label === 'marca') {
                    mapping['creation_brand'] = '__manual__';
                } else if (label === 'categoría') {
                    mapping['creation_category'] = '__manual__';
                    // Collect all categories with real values (including primary)
                    var allCats = [];
                    var $categorySelects = $('#cdep-categories-container .cdep-category-select');
                    $categorySelects.each(function () {
                        var v = $(this).val();
                        var t = $(this).find('option:selected').text();
                        if (v && v !== '__condicionar__' && v !== '__manual__') {
                            allCats.push(t);
                        }
                    });
                    if (allCats.length > 0) {
                        mapping['creation_categories'] = allCats;
                    }
                }
            } else if (selectedVal) {
                // Map brand/category fields to mapping keys
                if (label === 'marca') {
                    mapping['creation_brand'] = selectedText;
                } else if (label === 'categoría') {
                    // Collect all categories from the container
                    var categories = [];
                    var firstCategoryText = '';
                    var $categorySelects = $('#cdep-categories-container .cdep-category-select');
                    $categorySelects.each(function () {
                        var v = $(this).val();
                        var t = $(this).find('option:selected').text();
                        if (v && v !== '__condicionar__' && v !== '__manual__') {
                            categories.push(t);
                            if (!firstCategoryText) {
                                firstCategoryText = t;
                            }
                        }
                    });
                    if (categories.length > 0) {
                        mapping['creation_categories'] = categories;
                        mapping['creation_category'] = firstCategoryText;
                    } else {
                        mapping['creation_category'] = '';
                    }
                }

                // Config vars for templates (use text, not value)
                if (selectedText && label) {
                    var varName = label.replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
                    if (varName) {
                        configVars[varName] = selectedText;
                    }
                }
            }
        });

        // Extra category rows (added via "+ Agregar categoría"): each can independently
        // be a fixed category (handled above), "Condicionar" (own condition list, additive
        // — does not replace other categories), or "Edición Manual" (switches the whole
        // categoría field to manual mode, same as selecting it on the primary row).
        var categoryExtraConditions = [];
        var anyExtraCategoryManual = false;
        $('#cdep-categories-container .cdep-category-item').each(function (idx) {
            if (idx === 0) return;
            var v = $(this).find('.cdep-category-select').val();
            if (v === '__condicionar__') {
                var condList = [];
                $(this).find('.cdep-category-condition-row .cdep-condition-item').each(function () {
                    var colVal = $(this).find('.cdep-condition-column').val();
                    var opVal = $(this).find('.cdep-condition-operator').val();
                    var condVal = $(this).find('.cdep-condition-value').val();
                    var applyVal = $(this).find('.cdep-condition-apply').val();
                    if (colVal && condVal && applyVal) {
                        condList.push({
                            column: colVal,
                            operator: opVal || '=',
                            value: condVal,
                            apply: applyVal
                        });
                    }
                });
                if (condList.length > 0) categoryExtraConditions.push(condList);
            } else if (v === '__manual__') {
                anyExtraCategoryManual = true;
            }
        });
        if (categoryExtraConditions.length > 0) {
            mapping['creation_categories_conditions'] = categoryExtraConditions;
        }
        if (anyExtraCategoryManual) {
            mapping['creation_category'] = '__manual__';
        }

        var keys = [];
        for (var k in configVars) {
            if (configVars.hasOwnProperty(k)) keys.push(k);
        }
        if (keys.length > 0) {
            mapping['config_vars'] = configVars;
        }

        var condKeys = [];
        for (var ck in conditions) {
            if (conditions.hasOwnProperty(ck)) condKeys.push(ck);
        }
        if (condKeys.length > 0) {
            mapping['conditions'] = conditions;
        }

        // Attributes
        var attrs = [];
        $('#cdep-attributes-container .cdep-attribute-item').each(function () {
            var $item = $(this);
            var taxonomy = $item.find('.cdep-attribute-select').val();
            if (!taxonomy) return;
            var term = $item.find('.cdep-attribute-term-select').val();
            var isCond = term === '__condicionar__';
            var isManualAttr = term === '__manual__';
            if (!isCond && !isManualAttr && !term) return;
            var attrCondList = [];
            if (isCond) {
                $item.find('.cdep-attribute-condition-row .cdep-condition-item').each(function () {
                    var colVal = $(this).find('.cdep-condition-column').val();
                    var opVal = $(this).find('.cdep-condition-operator').val();
                    var condVal = $(this).find('.cdep-condition-value').val();
                    var applyVal = $(this).find('.cdep-condition-apply').val();
                    if (colVal && condVal && applyVal) {
                        attrCondList.push({
                            column: colVal,
                            operator: opVal || '=',
                            value: condVal,
                            apply: applyVal
                        });
                    }
                });
                if (attrCondList.length === 0) return;
            }
            attrs.push({
                taxonomy: taxonomy,
                term: isCond ? '' : (isManualAttr ? '__manual__' : term),
                conditions: attrCondList.length > 0 ? attrCondList : null
            });
        });
        if (attrs.length > 0) {
            mapping['attributes'] = attrs;
        }

        // Auto-manual for empty values
        if ($('#cdep-auto-manual-empty').is(':checked')) {
            mapping['auto_manual_empty'] = '1';
        }

        return mapping;
    }

    function saveMappingConfig(mapping) {
        try {
            localStorage.setItem('cdep_mapping_config', JSON.stringify(mapping));
        } catch (e) {}
    }

    function saveAiCache() {
        try {
            if (state.aiGenerated) {
                localStorage.setItem('cdep_ai_cache', JSON.stringify(state.aiGenerated));
            }
        } catch (e) {}
    }

    function loadAiCache() {
        try {
            var saved = localStorage.getItem('cdep_ai_cache');
            if (saved) {
                state.aiGenerated = JSON.parse(saved);
            }
        } catch (e) {}
    }

    function clearAiCache() {
        try {
            localStorage.removeItem('cdep_ai_cache');
            state.aiGenerated = null;
        } catch (e) {}
    }

    function saveManualData() {
        try {
            localStorage.setItem('cdep_manual_data', JSON.stringify(state.manualData));
        } catch (e) {}
    }

    function loadManualData() {
        try {
            var saved = localStorage.getItem('cdep_manual_data');
            if (saved) {
                state.manualData = JSON.parse(saved);
            }
        } catch (e) {}
    }

    function clearManualData() {
        try {
            localStorage.removeItem('cdep_manual_data');
            state.manualData = {};
        } catch (e) {}
    }

    function restoreMappingConfig() {
        try {
            var saved = localStorage.getItem('cdep_mapping_config');
            if (!saved) return;
            var mapping = JSON.parse(saved);
            if (mapping.sku) {
                $('#mapping-sku').val(mapping.sku);
            }
            if (mapping.decimal_char) {
                $('#cdep-decimal-char').val(mapping.decimal_char);
            }
            // Restore update fields
            $('.cdep-field-select').each(function () {
                var field = $(this).data('field');
                if (mapping[field]) {
                    var val = mapping[field];
                    var $td = $(this).closest('td');
                    if (typeof val === 'string' && val.indexOf('custom:') === 0) {
                        $(this).val('__custom__');
                        $td.find('.cdep-custom-template-input').val(val.substring(7));
                        $td.find('.cdep-custom-template-wrap').show();
                    } else if (typeof val === 'string' && val.indexOf('calc:') === 0) {
                        $(this).val('__calc__');
                        $td.find('.cdep-calc-input').val(val.substring(5));
                        $td.find('.cdep-calc-wrap').show();
                    } else if (val === '__manual__') {
                        $(this).val('__manual__');
                    } else if (val === '__ai__') {
                        $(this).val('__ai__');
                        var savedPrompt = mapping[field + '_prompt'];
                        if (savedPrompt) {
                            $td.find('.cdep-ai-prompt-input').val(savedPrompt);
                        }
                        $td.find('.cdep-ai-prompt-wrap').show();
                    } else {
                        $(this).val(val);
                    }
                }
            });
            // Restore create fields
            $('.cdep-field-select-create').each(function () {
                var field = $(this).data('field');
                if (mapping['create_' + field]) {
                    var val = mapping['create_' + field];
                    var $td = $(this).closest('td');
                    if (val === '__ai__') {
                        $(this).val('__ai__');
                        var savedPrompt = mapping['create_' + field + '_prompt'];
                        if (savedPrompt) {
                            $td.find('.cdep-ai-prompt-input').val(savedPrompt);
                        }
                        $td.find('.cdep-ai-prompt-wrap').show();
                    } else if (val === '__manual__') {
                        $(this).val('__manual__');
                    } else if (val.indexOf('custom:') === 0) {
                        $(this).val('__custom__');
                        $td.find('.cdep-custom-template-input').val(val.substring(7));
                        $td.find('.cdep-custom-template-wrap').show();
                    } else if (val.indexOf('calc:') === 0) {
                        $(this).val('__calc__');
                        $td.find('.cdep-calc-input').val(val.substring(5));
                        $td.find('.cdep-calc-wrap').show();
                    } else {
                        $(this).val(val);
                    }
                }
            });
            // Restore creation config
            if (mapping['creation_brand']) {
                $('#creation-brand').val(mapping['creation_brand']);
            }
            if (mapping['creation_category'] === '__manual__') {
                // Manual mode: primary select stays __manual__, all categories become extra selects
                var $firstSelect = $('#cdep-categories-container .cdep-category-select').first();
                if ($firstSelect.length) {
                    $firstSelect.val('__manual__');
                }
                if (mapping['creation_categories'] && mapping['creation_categories'].length > 0) {
                    for (var ci = 0; ci < mapping['creation_categories'].length; ci++) {
                        var $newItem = createCategoryItem();
                        $newItem.find('.cdep-category-select').val(mapping['creation_categories'][ci]);
                        $('#cdep-categories-container').append($newItem);
                    }
                }
            } else if (mapping['creation_categories'] && mapping['creation_categories'].length > 0) {
                // Restore first category in primary select
                var firstCat = mapping['creation_categories'][0];
                var $firstSelect = $('#cdep-categories-container .cdep-category-select').first();
                if ($firstSelect.length) {
                    $firstSelect.val(firstCat);
                }
                // Restore additional categories as extra selects
                for (var ci = 1; ci < mapping['creation_categories'].length; ci++) {
                    var $newItem = createCategoryItem();
                    $newItem.find('.cdep-category-select').val(mapping['creation_categories'][ci]);
                    $('#cdep-categories-container').append($newItem);
                }
            } else if (mapping['creation_category']) {
                var $catSelect = $('#cdep-categories-container .cdep-category-select').first();
                if ($catSelect.length) {
                    $catSelect.val(mapping['creation_category']);
                }
            }

            // Restore conditions
            if (mapping['conditions']) {
                var conds = mapping['conditions'];
                for (var target in conds) {
                    if (conds.hasOwnProperty(target)) {
                        var condList = conds[target];
                        // Support both single object and array format
                        if (!$.isArray(condList)) {
                            condList = [condList];
                        }
                        var $select = target === 'marca' ? $('#creation-brand') : $('#cdep-categories-container .cdep-category-select').first();
                        $select.val('__condicionar__');
                        // When restoring conditions for categoria, also add base categories as additional items
                        if (target === 'categoria' && mapping['creation_categories'] && mapping['creation_categories'].length > 0) {
                            var $container = $('#cdep-categories-container');
                            // Remove any existing extra category items (keep first one which is __condicionar__)
                            $container.find('.cdep-category-item:not(:first)').remove();
                            for (var ci = 0; ci < mapping['creation_categories'].length; ci++) {
                                var catVal = mapping['creation_categories'][ci];
                                var $newItem = createCategoryItem();
                                $newItem.find('.cdep-category-select').val(catVal);
                                $container.append($newItem);
                            }
                        }
                        var $row = $('.cdep-condition-row[data-condition="' + target + '"]');
                        $row.show();
                        var $container = $row.find('.cdep-condition-items');
                        $container.empty();
                        $.each(condList, function (i, condition) {
                            var $item = createConditionItem(target);
                            populateItemColumns($item);
                            if (condition.column) {
                                $item.find('.cdep-condition-column').val(condition.column);
                            }
                            if (condition.operator) {
                                $item.find('.cdep-condition-operator').val(condition.operator);
                            }
                            if (condition.value) {
                                $item.find('.cdep-condition-value').val(condition.value);
                            }
                            if (condition.apply) {
                                $item.find('.cdep-condition-apply').val(condition.apply);
                            }
                            $container.append($item);
                        });
                    }
                }
            }

            // Restore extra category rows with their own independent conditions
            if (mapping['creation_categories_conditions'] && mapping['creation_categories_conditions'].length > 0) {
                $.each(mapping['creation_categories_conditions'], function (i, condList) {
                    var $newItem = createCategoryItem();
                    $newItem.find('.cdep-category-select').val('__condicionar__');
                    var $condRow = $newItem.find('.cdep-category-condition-row');
                    $condRow.show();
                    var $condContainer = $condRow.find('.cdep-condition-items');
                    $.each(condList, function (ci, condition) {
                        var $condItem = createConditionItem('categoria_extra');
                        populateItemColumns($condItem);
                        if (condition.column) $condItem.find('.cdep-condition-column').val(condition.column);
                        if (condition.operator) $condItem.find('.cdep-condition-operator').val(condition.operator);
                        if (condition.value) $condItem.find('.cdep-condition-value').val(condition.value);
                        if (condition.apply) $condItem.find('.cdep-condition-apply').val(condition.apply);
                        $condContainer.append($condItem);
                    });
                    $('#cdep-categories-container').append($newItem);
                });
            }

            // Restore attributes
            if (mapping['attributes']) {
                var attrs = mapping['attributes'];
                $.each(attrs, function (i, attr) {
                    var $item = createAttributeItem();
                    $item.find('.cdep-attribute-select').val(attr.taxonomy);
                    populateAttributeTerms($item, attr.taxonomy);
                    if (attr.term) {
                        $item.find('.cdep-attribute-term-select').val(attr.term);
                    }
                    if (attr.conditions && attr.conditions.length > 0) {
                        $item.find('.cdep-attribute-term-select').val('__condicionar__');
                        var $condRow = $item.find('.cdep-attribute-condition-row');
                        $condRow.show();
                        var $condContainer = $condRow.find('.cdep-condition-items');
                        $condContainer.empty();
                        var taxonomy = attr.taxonomy;
                        $.each(attr.conditions, function (ci, cond) {
                            var $condItem = createAttributeCondItem(taxonomy);
                            populateItemColumns($condItem);
                            if (cond.column) $condItem.find('.cdep-condition-column').val(cond.column);
                            if (cond.operator) $condItem.find('.cdep-condition-operator').val(cond.operator);
                            if (cond.value) $condItem.find('.cdep-condition-value').val(cond.value);
                            if (cond.apply) $condItem.find('.cdep-condition-apply').val(cond.apply);
                            $condContainer.append($condItem);
                        });
                    }
                    $('#cdep-attributes-container').append($item);
                });
            }
        } catch (e) {}
    }

    // === AI CONFIG UI ===

    function toggleAiOptions(enabled) {
        $('.cdep-field-select-create').each(function () {
            var $sel = $(this);
            var $aiOpt = $sel.find('option[value="__ai__"]');
            if (enabled) {
                if ($aiOpt.length === 0) {
                    var $manualOpt = $sel.find('option[value="__manual__"]');
                    $manualOpt.after('<option value="__ai__">Generar con IA</option>');
                }
            } else {
                $aiOpt.remove();
                if ($sel.val() === '__ai__') {
                    $sel.val('');
                }
            }
        });
        // Update field selects: only text fields that support AI
        $('.cdep-field-select').each(function () {
            var field = $(this).data('field');
            if (field !== 'description' && field !== 'short_description' && field !== 'product_name') return;
            var $sel = $(this);
            var $aiOpt = $sel.find('option[value="__ai__"]');
            if (enabled) {
                if ($aiOpt.length === 0) {
                    var $manualOpt = $sel.find('option[value="__manual__"]');
                    $manualOpt.after('<option value="__ai__">Generar con IA</option>');
                }
            } else {
                $aiOpt.remove();
                if ($sel.val() === '__ai__') {
                    $sel.val('');
                    $sel.closest('td').find('.cdep-ai-prompt-wrap').hide();
                }
            }
        });
    }

    // === CUSTOM TEMPLATE UI ===

    $(document).on('change', '.cdep-field-select', function () {
        var val = $(this).val();
        var $td = $(this).closest('td');
        var $wrap = $td.find('.cdep-custom-template-wrap');
        var $calcWrap = $td.find('.cdep-calc-wrap');
        var $aiWrap = $td.find('.cdep-ai-prompt-wrap');
        if (val === '__custom__') {
            $wrap.show();
            $calcWrap.hide();
            $aiWrap.hide();
        } else if (val === '__calc__') {
            $wrap.hide();
            $calcWrap.show();
            $aiWrap.hide();
        } else if (val === '__ai__') {
            $wrap.hide();
            $calcWrap.hide();
            $aiWrap.show();
        } else {
            $wrap.hide();
            $calcWrap.hide();
            $aiWrap.hide();
        }
    });

    $(document).on('change', '.cdep-field-select-create', function () {
        var val = $(this).val();
        var $td = $(this).closest('td');
        var $wrap = $td.find('.cdep-custom-template-wrap');
        var $calcWrap = $td.find('.cdep-calc-wrap');
        var $aiWrap = $td.find('.cdep-ai-prompt-wrap');
        if (val === '__custom__') {
            $wrap.show();
            $calcWrap.hide();
            $aiWrap.hide();
        } else if (val === '__calc__') {
            $wrap.hide();
            $calcWrap.show();
            $aiWrap.hide();
        } else if (val === '__ai__') {
            $wrap.hide();
            $calcWrap.hide();
            $aiWrap.show();
        } else {
            $wrap.hide();
            $calcWrap.hide();
            $aiWrap.hide();
        }
    });

    $(document).on('click', '.cdep-template-variable-btn', function () {
        var $wrap = $(this).closest('.cdep-custom-template-wrap, .cdep-calc-wrap, .cdep-ai-prompt-wrap');
        var $list = $wrap.find('.cdep-template-variables-list');
        if ($list.is(':visible')) {
            $list.hide();
            return;
        }
        var html = '';

        // Config variables from Configuraciones de Creacion
        var hasConfig = false;
        $('#cdep-creation-config-table tbody tr').each(function () {
            var label = $(this).find('td:first').text().trim();
            var varName = label.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
            if (varName) {
                html += '<a href="#" class="cdep-template-variable-item" data-name="' + varName + '">' + escHtml(label) + '</a>';
                hasConfig = true;
            }
        });

        if (hasConfig) {
            html += '<div class="cdep-template-variable-separator"></div>';
        }

        // Column variables
        var headers = window.cdepParsedData ? window.cdepParsedData.headers : [];
        $.each(headers, function (i, h) {
            html += '<a href="#" class="cdep-template-variable-item" data-name="' + escHtml(h.name) + '">' + escHtml(h.name) + '</a>';
        });

        $list.html(html).show();
    });

    $(document).on('click', '.cdep-template-variable-item', function () {
        var name = $(this).data('name');
        var $wrap = $(this).closest('.cdep-custom-template-wrap, .cdep-calc-wrap, .cdep-ai-prompt-wrap');
        var $input = $wrap.find('.cdep-custom-template-input, .cdep-calc-input, .cdep-ai-prompt-input');
        var input = $input[0];
        if (!input) return false;
        var start = input.selectionStart;
        var end = input.selectionEnd;
        var text = input.value;
        input.value = text.substring(0, start) + '{' + name + '}' + text.substring(end);
        input.selectionStart = input.selectionEnd = start + name.length + 2;
        $input.focus();
        $(this).closest('.cdep-template-variables-list').hide();
        return false;
    });

    $(document).on('click', function (e) {
        if (!$(e.target).closest('.cdep-custom-template-wrap, .cdep-calc-wrap, .cdep-ai-prompt-wrap').length) {
            $('.cdep-template-variables-list').hide();
        }
    });

    // === CONDITION UI ===

    function createConditionItem(target) {
        var $item = $('<div class="cdep-condition-item">');
        var fieldsHtml = '<div class="cdep-condition-item-fields">'
            + '<select class="cdep-condition-column" style="width:100%"><option value="">— Columna —</option></select>'
            + '<select class="cdep-condition-operator" style="width:100%">'
            + '<option value="=">=</option><option value="!=">!=</option><option value="<">&lt;</option><option value=">">&gt;</option>'
            + '</select>'
            + '<input type="text" class="cdep-condition-value" placeholder="Valor" style="width:100%">';
        if (target === 'marca') {
            fieldsHtml += '<select class="cdep-condition-apply" style="width:100%">'
                + '<option value="">— Marca a aplicar —</option>';
            var brandOptions = $('#creation-brand option').not('[value=""], [value="__condicionar__"]');
            brandOptions.each(function () {
                fieldsHtml += '<option value="' + $(this).val() + '">' + $(this).text() + '</option>';
            });
            fieldsHtml += '</select>';
        } else {
            fieldsHtml += '<select class="cdep-condition-apply" style="width:100%">'
                + '<option value="">— Categoría a aplicar —</option>';
            var $catOpts = $('#cdep-categories-container .cdep-category-select').first().find('option').not('[value=""], [value="__condicionar__"], [value="__manual__"]');
            $catOpts.each(function () {
                fieldsHtml += '<option value="' + $(this).val() + '">' + $(this).text() + '</option>';
            });
            fieldsHtml += '</select>';
        }
        fieldsHtml += '</div>';
        $item.append(fieldsHtml);
        var $removeBtn = $('<button type="button" class="button button-small cdep-condition-remove">×</button>');
        $item.append($removeBtn);
        return $item;
    }

    function populateItemColumns($item) {
        var headers = window.cdepParsedData ? window.cdepParsedData.headers : [];
        var $sel = $item.find('.cdep-condition-column');
        $sel.find('option:not(:first)').remove();
        $.each(headers, function (i, h) {
            $sel.append('<option value="' + h.index + '">' + escHtml(h.name) + '</option>');
        });
    }

    $(document).on('change', '.cdep-config-condicionable', function () {
        var $row = $(this).closest('td').find('.cdep-condition-row');
        if ($(this).val() === '__condicionar__') {
            $row.show();
            if ($row.find('.cdep-condition-item').length === 0) {
                var target = $row.data('condition');
                var $item = createConditionItem(target);
                populateItemColumns($item);
                $row.find('.cdep-condition-items').append($item);
            }
        } else {
            $row.hide();
            $row.find('.cdep-condition-items').empty();
        }
    });

    $(document).on('click', '.cdep-condition-add', function () {
        // Skip if inside an attribute condition row (handled separately)
        if ($(this).closest('.cdep-attribute-condition-row').length > 0) return;
        var $row = $(this).closest('.cdep-condition-row');
        var target = $row.data('condition');
        var $item = createConditionItem(target);
        populateItemColumns($item);
        $row.find('.cdep-condition-items').append($item);
    });

    $(document).on('click', '.cdep-condition-remove', function () {
        $(this).closest('.cdep-condition-item').remove();
    });

    function populateConditionColumns() {
        var headers = window.cdepParsedData ? window.cdepParsedData.headers : [];
        $('.cdep-condition-column').each(function () {
            var $sel = $(this);
            var currentVal = $sel.val();
            $sel.find('option:not(:first)').remove();
            $.each(headers, function (i, h) {
                $sel.append('<option value="' + h.index + '">' + escHtml(h.name) + '</option>');
            });
            if (currentVal) {
                $sel.val(currentVal);
            }
        });
    }

    // === ATTRIBUTES UI ===

    function getAttributeTaxonomies() {
        if (cdep.attributeTaxonomies) return cdep.attributeTaxonomies;
        return [];
    }

    function createAttributeItem() {
        var $item = $('<div class="cdep-attribute-item">');
        var taxOptions = '<option value="">— Seleccionar atributo —</option>';
        var taxonomies = getAttributeTaxonomies();
        $.each(taxonomies, function (i, attr) {
            taxOptions += '<option value="' + attr.attribute_name + '">' + attr.attribute_label + '</option>';
        });
        var html = '<div class="cdep-attribute-fields">'
            + '<select class="cdep-attribute-select" style="width:100%">' + taxOptions + '</select>'
            + '<select class="cdep-attribute-term-select" style="width:100%"><option value="">— Término —</option><option value="__condicionar__">Condicionar</option><option value="__manual__">Edición Manual</option></select>'
            + '<button type="button" class="button button-small cdep-attribute-remove">×</button>'
            + '</div>'
            + '<div class="cdep-attribute-condition-row cdep-condition-row" style="display:none;margin-top:4px">'
            + '<div class="cdep-condition-items"></div>'
            + '<button type="button" class="button button-small cdep-condition-add">+ Agregar otra condición</button>'
            + '</div>';
        $item.append(html);
        return $item;
    }

    function createAttributeCondItem(taxonomy) {
        var $item = $('<div class="cdep-condition-item">');
        var fieldsHtml = '<div class="cdep-condition-item-fields">'
            + '<select class="cdep-condition-column" style="width:100%"><option value="">— Columna —</option></select>'
            + '<select class="cdep-condition-operator" style="width:100%">'
            + '<option value="=">=</option><option value="!=">!=</option><option value="<">&lt;</option><option value=">">&gt;</option>'
            + '</select>'
            + '<input type="text" class="cdep-condition-value" placeholder="Valor" style="width:100%">'
            + '<select class="cdep-condition-apply" style="width:100%"><option value="">— Término a aplicar —</option>';
        // Populate apply with terms of this attribute taxonomy
        var taxonomies = getAttributeTaxonomies();
        var found = null;
        $.each(taxonomies, function (i, attr) {
            if (attr.attribute_name === taxonomy) {
                found = attr;
                return false;
            }
        });
        if (found && found.terms) {
            $.each(found.terms, function (i, term) {
                fieldsHtml += '<option value="' + escHtml(term.name) + '">' + escHtml(term.name) + '</option>';
            });
        }
        fieldsHtml += '</select></div>';
        $item.append(fieldsHtml);
        var $removeBtn = $('<button type="button" class="button button-small cdep-condition-remove">×</button>');
        $item.append($removeBtn);
        return $item;
    }

    function populateAttributeTerms($item, taxonomy) {
        var $termSel = $item.find('.cdep-attribute-term-select');
        // Keep empty option, __condicionar__, and __manual__, remove old terms
        $termSel.find('option').filter(function () {
            return $(this).val() !== '' && $(this).val() !== '__condicionar__' && $(this).val() !== '__manual__';
        }).remove();
        if (!taxonomy) return;
        var taxonomies = getAttributeTaxonomies();
        var found = null;
        $.each(taxonomies, function (i, attr) {
            if (attr.attribute_name === taxonomy) {
                found = attr;
                return false;
            }
        });
        if (!found) return;
        var terms = found.terms || [];
        $.each(terms, function (i, term) {
            $termSel.append('<option value="' + escHtml(term.name) + '">' + escHtml(term.name) + '</option>');
        });
        $termSel.trigger('change');
    }

    // When attribute taxonomy changes, populate its terms
    $(document).on('change', '.cdep-attribute-select', function () {
        var $item = $(this).closest('.cdep-attribute-item');
        var taxonomy = $(this).val();
        populateAttributeTerms($item, taxonomy);
        // Also update apply selects in existing condition items
        $item.find('.cdep-condition-apply').each(function () {
            var $apply = $(this);
            var currentVal = $apply.val();
            $apply.find('option:not(:first)').remove();
            var taxonomies = getAttributeTaxonomies();
            var found = null;
            $.each(taxonomies, function (i, attr) {
                if (attr.attribute_name === taxonomy) {
                    found = attr;
                    return false;
                }
            });
            if (found && found.terms) {
                $.each(found.terms, function (i, term) {
                    $apply.append('<option value="' + escHtml(term.name) + '">' + escHtml(term.name) + '</option>');
                });
            }
            if (currentVal) $apply.val(currentVal);
        });
    });

    // Condicionar toggle for attribute term select
    $(document).on('change', '.cdep-attribute-term-select', function () {
        var $item = $(this).closest('.cdep-attribute-item');
        var $row = $item.find('.cdep-attribute-condition-row');
        if ($(this).val() === '__condicionar__') {
            $row.show();
            // Auto-add first condition item if empty
            if ($row.find('.cdep-condition-item').length === 0) {
                var taxonomy = $item.find('.cdep-attribute-select').val();
                if (taxonomy) {
                    var $condItem = createAttributeCondItem(taxonomy);
                    populateItemColumns($condItem);
                    $row.find('.cdep-condition-items').append($condItem);
                }
            }
        } else {
            $row.hide();
            $row.find('.cdep-condition-items').empty();
        }
    });

    $(document).on('click', '.cdep-attribute-add', function () {
        var $item = createAttributeItem();
        $('#cdep-attributes-container').append($item);
    });

    $(document).on('click', '.cdep-attribute-remove', function () {
        $(this).closest('.cdep-attribute-item').remove();
    });

    // === CATEGORIES UI ===

    function createCategoryItem() {
        var $item = $('<div class="cdep-category-item" style="margin-top:4px">');
        var $fields = $('<div class="cdep-category-item-fields" style="display:flex;gap:4px">');
        var $select = $('<select class="cdep-category-select cdep-category-select-extra" style="width:calc(100% - 28px)">');
        $select.append('<option value="">— Sin categoría —</option>');
        $select.append('<option value="__condicionar__">Condicionar</option>');
        $select.append('<option value="__manual__">Edición Manual</option>');
        // Copy real category options from the first category select (skip empty, __condicionar__, __manual__)
        var $firstSelect = $('#cdep-categories-container .cdep-category-select').first();
        if ($firstSelect.length) {
            var seen = {};
            $firstSelect.find('option').each(function () {
                var v = $(this).val();
                if (v && v !== '__condicionar__' && v !== '__manual__' && !seen[v]) {
                    seen[v] = true;
                    $select.append('<option value="' + v + '">' + $(this).text() + '</option>');
                }
            });
        }
        $fields.append($select);
        var $removeBtn = $('<button type="button" class="button button-small cdep-category-remove">×</button>');
        $fields.append($removeBtn);
        $item.append($fields);
        $item.append(
            '<div class="cdep-category-condition-row cdep-condition-row" data-condition="categoria_extra" style="display:none;margin-top:4px">'
            + '<div class="cdep-condition-items"></div>'
            + '<button type="button" class="button button-small cdep-condition-add">+ Agregar otra condición</button>'
            + '</div>'
        );
        return $item;
    }

    $(document).on('click', '.cdep-category-add', function () {
        var $item = createCategoryItem();
        $('#cdep-categories-container').append($item);
    });

    $(document).on('click', '.cdep-category-remove', function () {
        $(this).closest('.cdep-category-item').remove();
    });

    // Condicionar toggle for extra category rows (own, independent condition block)
    $(document).on('change', '.cdep-category-select-extra', function () {
        var $item = $(this).closest('.cdep-category-item');
        var $row = $item.find('.cdep-category-condition-row');
        if ($(this).val() === '__condicionar__') {
            $row.show();
            if ($row.find('.cdep-condition-item').length === 0) {
                var $condItem = createConditionItem('categoria_extra');
                populateItemColumns($condItem);
                $row.find('.cdep-condition-items').append($condItem);
            }
        } else {
            $row.hide();
            $row.find('.cdep-condition-items').empty();
        }
    });

    // Row-level category add/remove in preview table
    $(document).on('click', '.cdep-category-add-row', function () {
        var sku = $(this).data('sku');
        var $container = $(this).siblings('.cdep-row-categories-container');
        var catOptsHtml = '<option value="">— Sin categoría —</option>';
        var $firstCatSelect = $('#cdep-categories-container .cdep-category-select').first();
        if ($firstCatSelect.length) {
            var seen = {};
            $firstCatSelect.find('option').each(function () {
                var v = $(this).val();
                if (v && v !== '__condicionar__' && v !== '__manual__' && !seen[v]) {
                    seen[v] = true;
                    catOptsHtml += '<option value="' + v + '">' + $(this).text() + '</option>';
                }
            });
        }
        var $newItem = $('<div class="cdep-row-category-item" style="margin-top:2px">');
        $newItem.append('<select class="cdep-manual-input" data-sku="' + escHtml(sku) + '" data-field="__category__" style="width:calc(100% - 24px)">' + catOptsHtml + '</select>');
        $newItem.append('<button type="button" class="button button-small cdep-row-category-remove" style="width:22px;padding:0">×</button>');
        $container.append($newItem);
    });

    $(document).on('click', '.cdep-row-category-remove', function () {
        $(this).closest('.cdep-row-category-item').remove();
    });

    // Override the condition-add inside attribute condition rows to use attribute-specific items
    $(document).on('click', '.cdep-attribute-condition-row .cdep-condition-add', function () {
        var $row = $(this).closest('.cdep-attribute-condition-row');
        var $item = $(this).closest('.cdep-attribute-item');
        var taxonomy = $item.find('.cdep-attribute-select').val();
        if (!taxonomy) return;
        var $condItem = createAttributeCondItem(taxonomy);
        populateItemColumns($condItem);
        $row.find('.cdep-condition-items').append($condItem);
    });

    function renderStatusBadge(status) {
        var labels = {
            'pending': 'Pendiente',
            'new': 'Nuevo',
            'updated': 'Actualizado',
            'created': 'Creado',
        };
        var classes = {
            'pending': 'cdep-badge-pending',
            'new': 'cdep-badge-new',
            'updated': 'cdep-badge-ok',
            'created': 'cdep-badge-created',
        };
        var cls = classes[status] || 'cdep-badge-pending';
        var label = labels[status] || status;
        return '<span class="cdep-badge ' + cls + '">' + label + '</span>';
    }

    function renderFieldCell(fieldData, exists) {
        if (!fieldData || fieldData.new === '' || fieldData.new === null || fieldData.new === undefined) {
            return '<span class="cdep-empty-value">—</span>';
        }
        if (!exists) {
            return '<strong>' + escHtml(fieldData.new) + '</strong>';
        }
        if (!fieldData.changed) {
            return escHtml(fieldData.new);
        }
        return '<div class="cdep-diff">'
            + '<span class="cdep-old-value">' + escHtml(fieldData.current || '') + '</span>'
            + '<span class="cdep-new-value">' + escHtml(fieldData.new) + '</span>'
            + '</div>';
    }

    function isAutoManualActive() {
        return $('#cdep-auto-manual-empty').length && $('#cdep-auto-manual-empty').is(':checked');
    }

    function hasAllAiFields(sku, aiFields) {
        if (!state.aiGenerated || !state.aiGenerated[sku] || !aiFields || aiFields.length === 0) {
            return false;
        }
        for (var i = 0; i < aiFields.length; i++) {
            if (!state.aiGenerated[sku][aiFields[i]]) {
                return false;
            }
        }
        return true;
    }

    function renderProductsTable(products, mappedFields, productNameMapped, aiFields, manualFields, brandManual, categoryManual, hideCategoriesAttributes) {
        var html = '<div class="cdep-table-wrapper">';
        html += '<table class="wp-list-table widefat striped">';
        html += '<colgroup>';
        html += '<col style="width: 40px;">';
        html += '<col style="width: 110px;">';
        html += '<col style="width: 110px;">';
        html += '<col style="width: 70px;">';
        html += '<col style="width: auto;">';
        html += '<col style="width: auto;">';
        if (!hideCategoriesAttributes) {
            html += '<col style="width: auto;">';
            html += '<col style="width: auto;">';
        }
        if (brandManual) {
            html += '<col style="width: auto;">';
        }
        $.each(mappedFields, function (i, f) {
            html += '<col style="width: auto;">';
        });
        html += '</colgroup>';
        html += '<thead><tr>';
        html += '<th style="width:40px"><input type="checkbox" class="cdep-select-all" checked></th>';
        html += '<th>Acción</th><th>Estado</th><th>Imagen</th><th>SKU</th><th>Nombre</th>';
        if (!hideCategoriesAttributes) {
            html += '<th>Categorías</th><th>Atributos</th>';
        }
        if (brandManual) {
            html += '<th>Marca</th>';
        }
        $.each(mappedFields, function (i, f) {
            html += '<th>' + escHtml(f.label) + '</th>';
        });
        html += '</tr></thead><tbody>';

        var catOptions = [];
        if (categoryManual || brandManual) {
            var $firstCatSelect = $('#cdep-categories-container .cdep-category-select').first();
            if ($firstCatSelect.length) {
                var seen = {};
                $firstCatSelect.find('option').each(function () {
                    var v = $(this).val();
                    if (v && v !== '__condicionar__' && v !== '__manual__' && !seen[v]) {
                        seen[v] = true;
                        catOptions.push({ value: v, text: $(this).text() });
                    }
                });
            }
        }

        $.each(products, function (i, p) {
            var statusBadge = renderStatusBadge(p.status);
            html += '<tr class="cdep-product-row" data-sku="' + escHtml(p.sku) + '" data-status="' + p.status + '">';
            html += '<td><input type="checkbox" class="cdep-row-checkbox" value="' + escHtml(p.sku) + '" checked></td>';
            html += '<td>';
            html += '<div class="content-btn-procesing-in-table">';
            html += '<button class="button button-small cdep-process-single" data-sku="' + escHtml(p.sku) + '">Procesar</button>';
            if (aiFields && aiFields.length > 0 && !hasAllAiFields(p.sku, aiFields)) {
                html += ' <button class="button button-small cdep-ai-generate-row" data-sku="' + escHtml(p.sku) + '">Generar con IA</button>';
            }
            html += '</div>';
            html += '</td>';
            html += '<td class="cdep-status-cell">' + statusBadge + '</td>';
            html += '<td>' + (p.image || imageProductDefualt) + '</td>';
            var editUrl = p.exists && p.product_id ? cdep.ajaxurl.replace('admin-ajax.php', 'post.php?post=' + p.product_id + '&action=edit') : '';
            if (p.exists && p.product_id) {
                html += '<td><strong><a href="' + editUrl + '" target="_blank">' + escHtml(p.sku) + '</a></strong></td>';
            } else {
                html += '<td><strong>' + escHtml(p.sku) + '</strong></td>';
            }
            if (productNameMapped && p.fields['product_name']) {
                var isAiName = aiFields && aiFields.indexOf('product_name') !== -1;
                var nameFd = p.fields['product_name'];
                var nameEmpty = !nameFd || !nameFd.new || nameFd.new === '' || nameFd.new === null || nameFd.new === undefined;
                var useAutoManualName = !isAiName && nameEmpty && isAutoManualActive();
                if (isAiName && (!nameFd || !nameFd.new)) {
                    html += '<td class="cdep-field-cell-product_name"><span class="cdep-badge cdep-badge-ai">Pendiente de generar</span></td>';
                } else if (isAiName) {
                    html += '<td class="cdep-field-cell-product_name">' +
                        '<button class="button button-small cdep-view-ai-content" data-sku="' + escHtml(p.sku) + '" data-field="product_name">Ver contenido generado con IA</button>' +
                        ' <button class="button button-small cdep-ai-regenerate-field" data-sku="' + escHtml(p.sku) + '" data-field="product_name">Regenerar</button>' +
                        '</td>';
                } else if (useAutoManualName) {
                    var autoNameVal = '';
                    if (state.manualData && state.manualData[p.sku] && state.manualData[p.sku]['product_name'] !== undefined) {
                        autoNameVal = state.manualData[p.sku]['product_name'];
                    }
                    html += '<td class="cdep-field-cell-product_name"><input type="text" class="cdep-manual-input" data-sku="' + escHtml(p.sku) + '" data-field="product_name" value="' + escHtml(autoNameVal) + '" style="width:100%" placeholder="Editar..."></td>';
                } else {
                    var nameHtml = renderFieldCell(nameFd, p.exists);
                    if (p.exists && p.product_id) {
                        html += '<td class="cdep-field-cell-product_name"><a href="' + editUrl + '" target="_blank">' + nameHtml + '</a></td>';
                    } else {
                        html += '<td class="cdep-field-cell-product_name">' + nameHtml + '</td>';
                    }
                }
            } else {
                if (p.exists && p.product_id) {
                    html += '<td><a href="' + editUrl + '" target="_blank">' + escHtml(p.name) + '</a></td>';
                } else {
                    html += '<td>' + escHtml(p.name) + '</td>';
                }
            }

            // Categories column
            if (!hideCategoriesAttributes) {
                if (categoryManual) {
                    // The fixed/conditional categories already resolved for this row (p.categories,
                    // computed server-side) are shown read-only — manual mode only lets you ADD
                    // extra categories on top, it never edits or replaces these.
                    html += '<td>';
                    html += '<div class="cdep-resolved-categories" style="margin-bottom:4px;color:#555">'
                        + (p.categories ? escHtml(p.categories) : '<em>— Sin categoría fija/condicionada —</em>')
                        + '</div>';
                    html += '<div class="cdep-row-categories-container" data-sku="' + escHtml(p.sku) + '">';
                    var allSavedCats = [];
                    if (state.manualData && state.manualData[p.sku] && state.manualData[p.sku]['__categories__']) {
                        allSavedCats = state.manualData[p.sku]['__categories__'];
                    }
                    $.each(allSavedCats, function (ci, savedExtraCat) {
                        html += '<div class="cdep-row-category-item" style="margin-top:2px">';
                        html += '<select class="cdep-manual-input" data-sku="' + escHtml(p.sku) + '" data-field="__category__" style="width:calc(100% - 24px)">';
                        html += '<option value="">— Sin categoría —</option>';
                        if (catOptions) {
                            $.each(catOptions, function (i, opt) {
                                var sel = opt.value === savedExtraCat ? ' selected' : '';
                                html += '<option value="' + opt.value + '"' + sel + '>' + escHtml(opt.text) + '</option>';
                            });
                        }
                        html += '</select>';
                        html += '<button type="button" class="button button-small cdep-row-category-remove" style="width:22px;padding:0">×</button>';
                        html += '</div>';
                    });
                    html += '</div>';
                    html += '<button type="button" class="button button-small cdep-category-add-row" data-sku="' + escHtml(p.sku) + '" style="margin-top:2px">+ Categoría adicional</button>';
                    html += '</td>';
                } else {
                    html += '<td>' + escHtml(p.categories) + '</td>';
                }

                // Attributes column: fixed/conditional attributes are shown read-only,
                // only attributes actually set to "Edición Manual" get an editable select.
                var attrsHtml = '';
                if (p.attributes && p.attributes.length > 0) {
                    var manualAttrTaxonomies = {};
                    if (state.mapping && state.mapping.attributes) {
                        $.each(state.mapping.attributes, function (ai, attr) {
                            if (attr.term === '__manual__') {
                                manualAttrTaxonomies[attr.taxonomy] = true;
                            }
                        });
                    }
                    var hasManualAttr = false;
                    for (var mtKey in manualAttrTaxonomies) {
                        if (manualAttrTaxonomies.hasOwnProperty(mtKey)) {
                            hasManualAttr = true;
                            break;
                        }
                    }
                    if (hasManualAttr) {
                        var taxonomies = getAttributeTaxonomies();
                        attrsHtml = '<div class="cdep-manual-attributes">';
                        $.each(p.attributes, function (ai, attrStr) {
                            var parts = attrStr.split(': ');
                            var attrLabel = parts[0] || attrStr;
                            var attrVal = parts[1] || '';
                            var matchedTax = null;
                            $.each(taxonomies, function (ti, tax) {
                                if (tax.attribute_label === attrLabel || tax.attribute_name === attrLabel) {
                                    matchedTax = tax;
                                    return false;
                                }
                            });
                            var isThisManual = matchedTax && manualAttrTaxonomies[matchedTax.attribute_name];
                            if (isThisManual) {
                                attrsHtml += '<div style="margin-bottom:2px"><strong>' + escHtml(attrLabel) + ':</strong> ';
                                attrsHtml += '<select class="cdep-manual-attr-select" data-sku="' + escHtml(p.sku) + '" data-attr="' + escHtml(attrLabel) + '" style="width:100%">';
                                attrsHtml += '<option value="">— Seleccionar —</option>';
                                if (matchedTax && matchedTax.terms) {
                                    $.each(matchedTax.terms, function (tii, term) {
                                        var sel = term.name === attrVal ? ' selected' : '';
                                        attrsHtml += '<option value="' + escHtml(term.name) + '"' + sel + '>' + escHtml(term.name) + '</option>';
                                    });
                                }
                                attrsHtml += '</select></div>';
                            } else {
                                // Fixed or conditional attribute: read-only, not editable here
                                attrsHtml += '<div style="margin-bottom:2px"><strong>' + escHtml(attrLabel) + ':</strong> ' + escHtml(attrVal) + '</div>';
                            }
                        });
                        attrsHtml += '</div>';
                    } else {
                        attrsHtml = '<span class="cdep-attr-list">' + p.attributes.join('<br>') + '</span>';
                    }
                }
                html += '<td>' + attrsHtml + '</td>';
            }

            // Brand column
            if (brandManual) {
                var savedBrand = '';
                if (state.manualData && state.manualData[p.sku] && state.manualData[p.sku]['__brand__'] !== undefined) {
                    savedBrand = state.manualData[p.sku]['__brand__'];
                }
                html += '<td>';
                html += '<select class="cdep-manual-input cdep-manual-brand-select" data-sku="' + escHtml(p.sku) + '" data-field="__brand__" style="width:100%">';
                html += '<option value="">— Sin marca —</option>';
                if ($('#creation-brand').length) {
                    $('#creation-brand option').each(function () {
                        var v = $(this).val();
                        if (v && v !== '__condicionar__' && v !== '__manual__') {
                            var sel = v === savedBrand ? ' selected' : '';
                            html += '<option value="' + v + '"' + sel + '>' + $(this).text() + '</option>';
                        }
                    });
                }
                html += '</select>';
                html += '</td>';
            }

            // Mapped fields columns
            $.each(mappedFields, function (fi, f) {
                var fd = p.fields[f.key];
                var isAi = aiFields && aiFields.indexOf(f.key) !== -1;
                var isManual = manualFields && manualFields.indexOf(f.key) !== -1;
                var isEmpty = !fd || !fd.new || fd.new === '' || fd.new === null || fd.new === undefined;
                var useAutoManual = !isAi && !isManual && isEmpty && isAutoManualActive();
                if (isAi && (!fd || !fd.new)) {
                    html += '<td class="cdep-field-cell-' + f.key + '"><span class="cdep-badge cdep-badge-ai">Pendiente de generar</span></td>';
                } else if (isAi) {
                    html += '<td class="cdep-field-cell-' + f.key + '">' +
                        '<button class="button button-small cdep-view-ai-content" data-sku="' + escHtml(p.sku) + '" data-field="' + f.key + '">Ver contenido generado con IA</button>' +
                        ' <button class="button button-small cdep-ai-regenerate-field" data-sku="' + escHtml(p.sku) + '" data-field="' + f.key + '">Regenerar</button>' +
                        '</td>';
                } else if (isManual) {
                    var savedVal = '';
                    if (state.manualData && state.manualData[p.sku] && state.manualData[p.sku][f.key] !== undefined) {
                        savedVal = state.manualData[p.sku][f.key];
                    } else if (fd && fd.new) {
                        savedVal = fd.new;
                    }
                    html += '<td class="cdep-field-cell-' + f.key + '"><input type="text" class="cdep-manual-input" data-sku="' + escHtml(p.sku) + '" data-field="' + f.key + '" value="' + escHtml(savedVal) + '" style="width:100%"></td>';
                } else if (useAutoManual) {
                    var autoVal = '';
                    if (state.manualData && state.manualData[p.sku] && state.manualData[p.sku][f.key] !== undefined) {
                        autoVal = state.manualData[p.sku][f.key];
                    }
                    html += '<td class="cdep-field-cell-' + f.key + '"><input type="text" class="cdep-manual-input" data-sku="' + escHtml(p.sku) + '" data-field="' + f.key + '" value="' + escHtml(autoVal) + '" style="width:100%" placeholder="Editar..."></td>';
                } else {
                    html += '<td class="cdep-field-cell-' + f.key + '">' + (fd ? renderFieldCell(fd, p.exists) : '') + '</td>';
                }
            });
            html += '</tr>';
        });

        html += '</tbody></table></div>';
        return html;
    }

    $('#cdep-preview-update').on('click', function () {
        var mapping = buildMapping();

        if (!mapping.sku) {
            showMessage('#cdep-preview-result', 'Debes seleccionar la columna SKU', 'error');
            return;
        }

        state.mapping = mapping;
        saveMappingConfig(mapping);

        $(this).prop('disabled', true).text('Procesando...');

        ajax('cdep_update_preview', {
            mapping: mapping,
            ai_data: state.aiGenerated,
            manual_data: state.manualData,
        }, function (data) {
            renderPreviewResult(data);
            $('#cdep-preview-update').prop('disabled', false).text('Vista Previa de Actualización');
        }, function (msg) {
            showMessage('#cdep-preview-result', msg, 'error');
            $('#cdep-preview-update').prop('disabled', false).text('Vista Previa de Actualización');
        });
    });

    $(document).on('click', '#cdep-refresh-file', function (e) {
        e.preventDefault();
        var btn = $(this);
        btn.prop('disabled', true).text('Actualizando...');

        ajax('cdep_refresh_cache', {
            delimiter: $('#cdep-delimiter').length ? $('#cdep-delimiter').val() : 'auto',
        }, function (data) {
            window.cdepParsedData = data;
            $('#cdep-preview-result').html('');
            loadMapping();
            showMessage('#cdep-mapping-container', 'Archivo actualizado correctamente', 'ok');
            btn.prop('disabled', false).text('Actualizar Archivo');
        }, function (msg) {
            showMessage('#cdep-mapping-container', msg, 'error');
            btn.prop('disabled', false).text('Actualizar Archivo');
        });
    });

    $(document).on('click', '#cdep-apply-header-row', function () {
        var headerRow = parseInt($('#cdep-header-row').val(), 10);
        if (isNaN(headerRow) || headerRow < 0) {
            showMessage('#cdep-mapping-container', 'Ingrese un número de fila válido', 'error');
            return;
        }
        var btn = $(this);
        btn.prop('disabled', true).text('Aplicando...');

        ajax('cdep_reparse_file', {
            header_row: headerRow,
            delimiter: $('#cdep-delimiter').length ? $('#cdep-delimiter').val() : 'auto',
        }, function (data) {
            window.cdepParsedData = data;
            clearAiCache();
            clearManualData();
            $('#cdep-preview-result').html('');
            location.reload();
        }, function (msg) {
            showMessage('#cdep-mapping-container', msg, 'error');
            btn.prop('disabled', false).text('Aplicar');
        });
    });

    if ($('#cdep-mapping-container').length && $('#mapping').is(':visible')) {
        loadMapping();
    }

    // === UPDATE EXECUTION ===

    $(document).on('change', '.cdep-select-all', function () {
        $(this).closest('.cdep-table-wrapper').find('.cdep-row-checkbox').prop('checked', $(this).prop('checked'));
    });

    function findRowBySku(sku) {
        var match = null;
        $('.cdep-product-row').each(function () {
            if ($(this).attr('data-sku') === sku) {
                match = $(this);
                return false;
            }
        });
        return match;
    }

    function collectManualData(containerId) {
        var data = {};
        $('#' + containerId + ' .cdep-manual-input').each(function () {
            var sku = $(this).data('sku');
            var field = $(this).data('field');
            var value = $(this).val();
            if (!data[sku]) {
                data[sku] = {};
            }
            data[sku][field] = value;
        });
        // Collect manual attribute selects
        $('#' + containerId + ' .cdep-manual-attr-select').each(function () {
            var sku = $(this).data('sku');
            var attrLabel = $(this).data('attr');
            var value = $(this).val();
            if (!value) return;
            // Map attribute label back to taxonomy name
            var taxonomies = getAttributeTaxonomies();
            var taxonomyName = '';
            $.each(taxonomies, function (ti, tax) {
                if (tax.attribute_label === attrLabel || tax.attribute_name === attrLabel) {
                    taxonomyName = tax.attribute_name;
                    return false;
                }
            });
            if (!taxonomyName) return;
            if (!data[sku]) {
                data[sku] = {};
            }
            data[sku][taxonomyName] = value;
        });
        // Collect categories: group all category selects per SKU into __categories__ array
        var allCats = {};
        $('#' + containerId + ' .cdep-manual-category-select').each(function () {
            var sku = $(this).data('sku');
            var value = $(this).val();
            if (!allCats[sku]) {
                allCats[sku] = [];
            }
            if (value) {
                allCats[sku].push(value);
            }
        });
        $('#' + containerId + ' .cdep-row-category-item select.cdep-manual-input').each(function () {
            var sku = $(this).data('sku');
            var value = $(this).val();
            if (!allCats[sku]) {
                allCats[sku] = [];
            }
            if (value) {
                allCats[sku].push(value);
            }
        });
        $.each(allCats, function (sku, cats) {
            if (!data[sku]) {
                data[sku] = {};
            }
            data[sku]['__categories__'] = cats;
        });
        return data;
    }

    function runBatchUpdate(containerId, buttonId, progressId, resultId, mapping, aiData) {
        var $container = $('#' + containerId);
        var btn = $('#' + buttonId);
        var checkedSkus = [];

        $container.find('.cdep-row-checkbox:checked').each(function () {
            checkedSkus.push($(this).val());
        });

        if (checkedSkus.length === 0) {
            showMessage('#' + resultId, 'Selecciona al menos un producto', 'error');
            return;
        }

        btn.prop('disabled', true).text('Actualizando...');
        $('#' + progressId).show();
        $('#' + resultId).html('');

        var totalSkus = checkedSkus.length;
        var totalUpdated = 0;
        var totalCreated = 0;
        var allErrors = [];
        var processedCount = 0;
        var batchSize = 25;
        var manualData = collectManualData(containerId);

        var batches = [];
        for (var i = 0; i < totalSkus; i += batchSize) {
            batches.push(checkedSkus.slice(i, i + batchSize));
        }

        function processBatch(idx) {
            if (idx >= batches.length) {
                btn.prop('disabled', false).text('Iniciar Actualización Masiva');
                var resultHtml = '<div class="notice notice-success inline"><p>';
                resultHtml += '<strong>Actualización completada</strong><br>';
                resultHtml += 'Actualizados: ' + totalUpdated + ' | ';
                resultHtml += 'Creados: ' + totalCreated + '<br>';
                if (allErrors.length > 0) {
                    resultHtml += 'Errores: ' + allErrors.length;
                }
                resultHtml += '</p></div>';

                if (allErrors.length > 0) {
                    resultHtml += '<h4>Errores</h4>';
                    resultHtml += '<div class="cdep-table-scroll"><table class="wp-list-table widefat striped">';
                    resultHtml += '<thead><tr><th>SKU</th><th>Error</th></tr></thead><tbody>';
                    $.each(allErrors.slice(0, 50), function (i, err) {
                        resultHtml += '<tr><td>' + escHtml(err.sku) + '</td><td>' + escHtml(err.error) + '</td></tr>';
                    });
                    if (allErrors.length > 50) {
                        resultHtml += '<tr><td colspan="2">... y ' + (allErrors.length - 50) + ' más</td></tr>';
                    }
                    resultHtml += '</tbody></table></div>';
                }

                $('#' + resultId).html(resultHtml);
                $('#' + containerId + ' .cdep-progress-text').text('Completado: ' + totalUpdated + ' actualizados, ' + totalCreated + ' creados');
                return;
            }

            var batchAiData = {};
            if (aiData) {
                $.each(batches[idx], function (i, sku) {
                    if (aiData[sku]) {
                        batchAiData[sku] = aiData[sku];
                    }
                });
            }
            ajax('cdep_update_batch_skus', {
                skus: batches[idx],
                mapping: mapping,
                ai_data: batchAiData,
                manual_data: manualData,
            }, function (data) {
                totalUpdated += data.updated;
                totalCreated += data.created;

                if (data.processed_skus) {
                    $.each(data.processed_skus, function (i, item) {
                        var $row = findRowBySku(item.sku);
                        if ($row) {
                            $row.attr('data-status', item.status);
                            $row.find('.cdep-status-cell').html(renderStatusBadge(item.status));
                            $row.find('.cdep-diff').each(function () {
                                var newVal = $(this).find('.cdep-new-value').text();
                                $(this).replaceWith('<strong>' + newVal + '</strong>');
                            });
                            // If created, update SKU and Name to links to the product editor
                            if (item.status === 'created' && item.product_id) {
                                var editUrl = cdep.ajaxurl.replace('admin-ajax.php', 'post.php?post=' + item.product_id + '&action=edit');
                                var $skuCell = $row.find('td').eq(4);
                                $skuCell.html('<strong><a href="' + editUrl + '" target="_blank">' + escHtml(item.sku) + '</a></strong>');
                                var $nameCell = $row.find('td').eq(5);
                                var nameText = $nameCell.find('strong').text() || $nameCell.text().trim();
                                if (nameText) {
                                    $nameCell.html('<a href="' + editUrl + '" target="_blank">' + escHtml(nameText) + '</a>');
                                }
                            }
                        }
                        processedCount++;
                    });
                }

                if (data.errors) {
                    $.each(data.errors, function (i, err) {
                        var $row = findRowBySku(err.sku);
                        if ($row) {
                            $row.attr('data-status', 'error');
                            $row.find('.cdep-status-cell').html(renderStatusBadge('error'));
                        }
                    });
                    allErrors = allErrors.concat(data.errors);
                }

                var progress = Math.min(100, Math.round(processedCount / totalSkus * 100));
                $('#' + containerId + ' .cdep-progress-fill').css('width', progress + '%');
                $('#' + containerId + ' .cdep-progress-text').text(processedCount + ' / ' + totalSkus + ' productos procesados');

                processBatch(idx + 1);
            }, function (msg) {
                btn.prop('disabled', false).text('Iniciar Actualización Masiva');
                showMessage('#' + resultId, msg, 'error');
            });
        }

        processBatch(0);
    }

    $(document).on('click', '#cdep-start-update', function () {
        runBatchUpdate('cdep-preview-update-content', 'cdep-start-update', 'cdep-update-progress', 'cdep-update-result', state.mapping, state.aiGenerated);
    });

    $(document).on('click', '#cdep-start-create', function () {
        runBatchUpdate('cdep-preview-create-content', 'cdep-start-create', 'cdep-create-progress', 'cdep-create-result', state.mapping, state.aiGenerated);
    });

    function getManualFieldsFromMapping() {
        var manualFields = [];
        if (!state.mapping) return manualFields;
        for (var key in state.mapping) {
            if (state.mapping.hasOwnProperty(key) && state.mapping[key] === '__manual__') {
                if (key.indexOf('create_') === 0) {
                    manualFields.push(key.replace('create_', ''));
                } else if (key === 'regular_price' || key === 'sale_price' || key === 'stock_quantity' || key === 'description' || key === 'short_description') {
                    manualFields.push(key);
                }
            }
        }
        return manualFields;
    }

    function renderPreviewResult(data) {
        var html = '<div class="cdep-preview-summary">';
        html += '<p><strong>Total filas con SKU:</strong> ' + data.total + ' | ';
        html += '<strong>Existentes:</strong> ' + data.found + ' | ';
        html += '<strong>Nuevos:</strong> ' + data.new_count + '</p>';
        html += '</div>';

        if (data.products && data.products.length > 0) {
            var updateMappedFields = [];
            var updateProductNameMapped = false;
            var updateLabels = data.update_field_labels || data.field_labels;
            if (updateLabels) {
                $.each(updateLabels, function (key, label) {
                    if (key === 'product_name') {
                        updateProductNameMapped = true;
                    } else {
                        updateMappedFields.push({ key: key, label: label });
                    }
                });
            }

            var createMappedFields = [];
            var createProductNameMapped = false;
            var createLabels = data.create_field_labels || data.field_labels;
            if (createLabels) {
                $.each(createLabels, function (key, label) {
                    if (key === 'product_name') {
                        createProductNameMapped = true;
                    } else {
                        createMappedFields.push({ key: key, label: label });
                    }
                });
            }

            var aiFields = data.ai_fields || [];
            var manualFields = getManualFieldsFromMapping();
            var existingProducts = [];
            var newProducts = [];
            $.each(data.products, function (i, p) {
                if (p.exists) {
                    existingProducts.push(p);
                } else {
                    newProducts.push(p);
                }
            });

            var hasAiFields = aiFields.length > 0;
            var brandManual = state.mapping && state.mapping['creation_brand'] === '__manual__';
            var categoryManual = state.mapping && state.mapping['creation_category'] === '__manual__';
            var autoManualActive = isAutoManualActive();
            var hasManualFields = manualFields.length > 0 || brandManual || categoryManual || autoManualActive;

            html += '<h3>Productos a procesar</h3>';
            html += '<div class="cdep-preview-tabs-wrapper">';
            html += '<div class="cdep-preview-tabs">';
            html += '<a href="#" class="cdep-preview-tab active" data-tab="update">Productos a actualizar (' + existingProducts.length + ')</a>';
            html += '<a href="#" class="cdep-preview-tab" data-tab="create">Productos a crear (' + newProducts.length + ')</a>';
            html += '</div>';

            // Update tab
            html += '<div class="cdep-preview-tab-content active" id="cdep-preview-update-content" data-tab="update">';
            if (existingProducts.length > 0) {
                var updateAiFields = [];
                $.each(aiFields, function (i, f) {
                    // Only include AI fields that are mapped for update (non-create)
                    if (f === 'description' || f === 'short_description') {
                        updateAiFields.push(f);
                    }
                });
                html += renderProductsTable(existingProducts, updateMappedFields, updateProductNameMapped, updateAiFields, manualFields, false, false, true);
                html += '<hr>';
                html += '<p><button id="cdep-start-update" class="button button-primary">Iniciar Actualización Masiva</button>';
                if (updateAiFields.length > 0) {
                    var allUpdateAiDone = true;
                    $.each(existingProducts, function (aiCheckI, aiCheckP) {
                        if (!hasAllAiFields(aiCheckP.sku, updateAiFields)) {
                            allUpdateAiDone = false;
                            return false;
                        }
                    });
                    if (!allUpdateAiDone) {
                        html += ' <button id="cdep-ai-generate-update" class="button cdep-ai-generate-btn">Generar contenido con IA</button>';
                    }
                }
                if (hasManualFields) {
                    html += ' <button id="cdep-save-manual-update" class="button">Guardar Edición Manual</button>';
                }
                html += '</p>';
            } else {
                html += '<p>No hay productos existentes para actualizar.</p>';
            }
            html += '<div id="cdep-update-progress" style="display:none">';
            html += '<div class="cdep-progress-bar"><div class="cdep-progress-fill" style="width:0%"></div></div>';
            html += '<p class="cdep-progress-text">0 / ' + existingProducts.length + ' productos procesados</p>';
            html += '</div>';
            html += '<div id="cdep-update-result"></div>';
            html += '</div>';

            // Create tab
            html += '<div class="cdep-preview-tab-content" id="cdep-preview-create-content" data-tab="create">';
            if (newProducts.length > 0) {
                html += renderProductsTable(newProducts, createMappedFields, createProductNameMapped, aiFields, manualFields, brandManual, categoryManual);
                html += '<hr>';
                // Check if all new products already have all AI fields generated
                var allAiDone = true;
                if (hasAiFields) {
                    $.each(newProducts, function (aiCheckI, aiCheckP) {
                        if (!hasAllAiFields(aiCheckP.sku, aiFields)) {
                            allAiDone = false;
                            return false;
                        }
                    });
                }
                var showBatchAi = hasAiFields && !allAiDone;
                html += '<p>';
                html += '<button id="cdep-start-create" class="button button-primary">Iniciar Creación Masiva</button>';
                if (showBatchAi) {
                    html += ' <button id="cdep-ai-generate-create" class="button cdep-ai-generate-btn">Generar contenido con IA</button>';
                }
                if (hasManualFields) {
                    html += ' <button id="cdep-save-manual" class="button">Guardar Edición Manual</button>';
                }
                html += '</p>';
            } else {
                html += '<p>No hay productos nuevos para crear.</p>';
            }
            html += '<div id="cdep-create-progress" style="display:none">';
            html += '<div class="cdep-progress-bar"><div class="cdep-progress-fill" style="width:0%"></div></div>';
            html += '<p class="cdep-progress-text">0 / ' + newProducts.length + ' productos procesados</p>';
            html += '</div>';
            html += '<div id="cdep-create-result"></div>';
            html += '</div>';

            html += '</div>';
        }

        html += '<p>Archivo: <strong>' + escHtml(data.file_name) + '</strong></p>';

        state.products = data.products;

        $('#cdep-preview-result').html(html);
    }

    // === AI GENERATE BUTTON (batch one-by-one) ===
    $(document).on('click', '.cdep-ai-generate-btn', function () {
        var $container = $(this).closest('.cdep-preview-tab-content');
        var checkedSkus = [];
        $container.find('.cdep-row-checkbox:checked').each(function () {
            checkedSkus.push($(this).val());
        });

        if (checkedSkus.length === 0) {
            showMessage('#cdep-preview-result', 'Selecciona al menos un producto', 'error');
            return;
        }

        // Derive AI fields from mapping (both create_ prefixed and non-prefixed)
        var aiFields = [];
        if (state.mapping) {
            $.each(state.mapping, function (key, val) {
                if (val === '__ai__') {
                    if (key.indexOf('create_') === 0) {
                        aiFields.push(key.replace('create_', ''));
                    } else {
                        aiFields.push(key);
                    }
                }
            });
        }

        // Filter out SKUs that already have all AI fields generated
        var skusToProcess = [];
        $.each(checkedSkus, function (ci, cSku) {
            if (!hasAllAiFields(cSku, aiFields)) {
                skusToProcess.push(cSku);
            }
        });

        if (skusToProcess.length === 0) {
            showMessage('#cdep-preview-result', 'Todos los productos seleccionados ya tienen contenido generado con IA', 'ok');
            return;
        }

        var btn = $(this);
        var totalSkus = skusToProcess.length;
        var processedCount = 0;
        var allErrors = [];

        btn.prop('disabled', true).text('Generando...');
        $('#cdep-start-create').prop('disabled', true);
        $('#cdep-create-progress').show();
        $('#cdep-create-progress .cdep-progress-fill').css('width', '0%');
        $('#cdep-create-progress .cdep-progress-text').text('0 / ' + totalSkus + ' productos generados');

        // Replace checkedSkus with filtered list
        checkedSkus = skusToProcess;

        function processNext(idx) {
            if (idx >= checkedSkus.length) {
                btn.prop('disabled', false).text('Generar contenido con IA');
                $('#cdep-start-create').prop('disabled', false);
                var completionText = 'Completado: ' + processedCount + ' generados';
                if (allErrors.length > 0) {
                    completionText += ', ' + allErrors.length + ' con errores';
                }
                $('#cdep-create-progress .cdep-progress-text').text(completionText);

                // Re-run preview to consolidate AI data
                $('#cdep-preview-update').prop('disabled', true).text('Procesando...');
                ajax('cdep_update_preview', {
                    mapping: state.mapping,
                    ai_data: state.aiGenerated,
                    manual_data: state.manualData,
                }, function (previewData) {
                    state.products = previewData.products;
                    renderPreviewResult(previewData);
                    $('.cdep-preview-tab').removeClass('active');
                    $('.cdep-preview-tab[data-tab="create"]').addClass('active');
                    $('.cdep-preview-tab-content').removeClass('active');
                    $('.cdep-preview-tab-content[data-tab="create"]').addClass('active');
                    $('#cdep-preview-update').prop('disabled', false).text('Vista Previa de Actualización');
                    if (allErrors.length > 0) {
                        var $errMsg = $('<p class="fwue-message error">' + allErrors.length + ' producto(s) con errores. Revisa las filas marcadas en rojo.</p>');
                        $('#cdep-preview-result').prepend($errMsg);
                        setTimeout(function () { $errMsg.remove(); }, 15000);
                    }
                    var $msg = $('<p class="fwue-message ok">Contenido generado correctamente para ' + processedCount + ' productos.</p>');
                    $('#cdep-preview-result').prepend($msg);
                    setTimeout(function () { $msg.remove(); }, 8000);
                }, function (msg) {
                    $('#cdep-preview-update').prop('disabled', false).text('Vista Previa de Actualización');
                    var $msg = $('<p class="fwue-message error">' + msg + '</p>');
                    $('#cdep-preview-result').prepend($msg);
                    setTimeout(function () { $msg.remove(); }, 8000);
                });
                return;
            }

            var sku = checkedSkus[idx];
            btn.text('Generando... (' + (idx + 1) + '/' + totalSkus + ')');

            ajax('cdep_ai_generate', {
                mapping: state.mapping,
                skus: [sku],
                ai_provider: cdep.ai_provider,
            }, function (data) {
                // Handle rate limiting: red progress bar with 60s countdown, then retry
                if (data.rate_limited) {
                    var $bar = $('#cdep-create-progress .cdep-progress-fill');
                    var $text = $('#cdep-create-progress .cdep-progress-text');
                    var originalBg = $bar.css('background');
                    $bar.css('background', '#dc3545');
                    var waitSeconds = 60;
                    $text.text('Limite de peticiones alcanzado. Esperando ' + waitSeconds + 's...');

                    var timer = setInterval(function () {
                        waitSeconds--;
                        $text.text('Limite de peticiones alcanzado. Esperando ' + waitSeconds + 's...');
                        if (waitSeconds <= 0) {
                            clearInterval(timer);
                            $bar.css('background', originalBg);
                            processNext(idx); // retry same SKU
                        }
                    }, 1000);
                    return;
                }

                if (!state.aiGenerated) {
                    state.aiGenerated = {};
                }

                // Log errors for this SKU
                if (data.errors && data.errors.length > 0) {
                    $.each(data.errors, function (i, err) {
                        allErrors.push(err);
                    });
                    var $row = findRowBySku(sku);
                    if ($row) {
                        $row.attr('data-status', 'error');
                    }
                }

                if (data.data && data.data[sku]) {
                    state.aiGenerated[sku] = data.data[sku];
                    saveAiCache();
                    processedCount++;

                    // Update the row in the table with "Ver contenido" button
                    var $row = findRowBySku(sku);
                    if ($row) {
                        var aiFields = [];
                        if (state.mapping) {
                            $.each(state.mapping, function (key, val) {
                                if (key.indexOf('create_') === 0 && val === '__ai__') {
                                    aiFields.push(key.replace('create_', ''));
                                }
                            });
                        }
                        $.each(aiFields, function (i, fk) {
                            var $cell = $row.find('.cdep-field-cell-' + fk);
                            if ($cell.length) {
                                $cell.html(
                                    '<button class="button button-small cdep-view-ai-content" data-sku="' + escHtml(sku) + '" data-field="' + fk + '">Ver contenido generado con IA</button>' +
                                    ' <button class="button button-small cdep-ai-regenerate-field" data-sku="' + escHtml(sku) + '" data-field="' + fk + '">Regenerar</button>'
                                );
                            }
                        });
                        var isAiName = aiFields.indexOf('product_name') !== -1;
                        if (isAiName && state.aiGenerated[sku] && state.aiGenerated[sku]['product_name']) {
                            $row.find('td').eq(5).html(
                                '<button class="button button-small cdep-view-ai-content" data-sku="' + escHtml(sku) + '" data-field="product_name">Ver contenido generado con IA</button>' +
                                ' <button class="button button-small cdep-ai-regenerate-field" data-sku="' + escHtml(sku) + '" data-field="product_name">Regenerar</button>'
                            );
                        }
                    }
                }

                var progress = Math.min(100, Math.round((idx + 1) / totalSkus * 100));
                $('#cdep-create-progress .cdep-progress-fill').css('width', progress + '%');
                $('#cdep-create-progress .cdep-progress-text').text((idx + 1) + ' / ' + totalSkus + ' productos generados');

                processNext(idx + 1);
            }, function (msg) {
                allErrors.push({ sku: sku, error: msg });
                var $row = findRowBySku(sku);
                if ($row) {
                    $row.attr('data-status', 'error');
                }
                var progress = Math.min(100, Math.round((idx + 1) / totalSkus * 100));
                $('#cdep-create-progress .cdep-progress-fill').css('width', progress + '%');
                $('#cdep-create-progress .cdep-progress-text').text((idx + 1) + ' / ' + totalSkus + ' productos generados');
                processNext(idx + 1);
            });
        }

        processNext(0);
    });

    // === SAVE MANUAL DATA ===

    $(document).on('click', '#cdep-save-manual, #cdep-save-manual-update', function () {
        var btn = $(this);
        btn.prop('disabled', true).text('Guardando...');

        var isUpdate = btn.attr('id') === 'cdep-save-manual-update';
        var containerSel = isUpdate ? '#cdep-preview-update-content' : '#cdep-preview-create-content';

        // Collect all manual inputs from the tab
        var manualData = {};
        $(containerSel + ' .cdep-manual-input').each(function () {
            var sku = $(this).data('sku');
            var field = $(this).data('field');
            var value = $(this).val();
            if (!manualData[sku]) {
                manualData[sku] = {};
            }
            manualData[sku][field] = value;
        });

        // Collect manual attribute selects
        $(containerSel + ' .cdep-manual-attr-select').each(function () {
            var sku = $(this).data('sku');
            var attrLabel = $(this).data('attr');
            var value = $(this).val();
            if (!value) return;
            var taxonomies = getAttributeTaxonomies();
            var taxonomyName = '';
            $.each(taxonomies, function (ti, tax) {
                if (tax.attribute_label === attrLabel || tax.attribute_name === attrLabel) {
                    taxonomyName = tax.attribute_name;
                    return false;
                }
            });
            if (!taxonomyName) return;
            if (!manualData[sku]) {
                manualData[sku] = {};
            }
            manualData[sku][taxonomyName] = value;
        });

        // Collect categories specially: group by SKU
        $(containerSel + ' .cdep-manual-category-select').each(function () {
            var sku = $(this).data('sku');
            if (!manualData[sku]) {
                manualData[sku] = {};
            }
        });
        // For each SKU, collect all category selects into an array
        var skuCategories = {};
        $(containerSel + ' .cdep-manual-category-select, ' + containerSel + ' .cdep-row-category-item select.cdep-manual-input').each(function () {
            var sku = $(this).data('sku');
            var value = $(this).val();
            if (!skuCategories[sku]) {
                skuCategories[sku] = [];
            }
            if (value) {
                skuCategories[sku].push(value);
            }
        });
        $.each(skuCategories, function (sku, cats) {
            if (!manualData[sku]) {
                manualData[sku] = {};
            }
            manualData[sku]['__categories__'] = cats;
        });

        state.manualData = manualData;
        saveManualData();

        btn.prop('disabled', false).text('Guardar Edición Manual');
        var $msg = $('<p class="fwue-message ok">Datos de edición manual guardados correctamente.</p>');
        $('#cdep-preview-result').prepend($msg);
        setTimeout(function () { $msg.remove(); }, 8000);
    });

    // === SINGLE PRODUCT PROCESS ===

    $(document).on('click', '.cdep-process-single', function () {
        var btn = $(this);
        var sku = btn.attr('data-sku');
        var mapping = state.mapping;
        var $row = btn.closest('.cdep-product-row');
        var $container = $row.closest('.cdep-preview-tab-content');
        var containerId = $container.attr('id');

        if (!mapping || !mapping.sku) {
            showMessage('#cdep-update-result', 'Primero haz una vista previa', 'error');
            return;
        }

        btn.prop('disabled', true).text('Procesando...');

        // Collect current manual data from the UI (same as batch update)
        var manualData = collectManualData(containerId);

        ajax('cdep_update_single', {
            sku: sku,
            mapping: mapping,
            ai_data: state.aiGenerated,
            manual_data: manualData,
        }, function (data) {
            if (data.processed_skus && data.processed_skus.length > 0) {
                var item = data.processed_skus[0];
                var status = item.status;

                // Update status badge
                $row.attr('data-status', status);
                $row.find('.cdep-status-cell').html(renderStatusBadge(status));

                // Flatten diff cells — replace with just the new value
                $row.find('.cdep-diff').each(function () {
                    var newVal = $(this).find('.cdep-new-value').text();
                    $(this).replaceWith('<strong>' + newVal + '</strong>');
                });

                // If created, update SKU and Name to links to the product editor
                if (status === 'created' && item.product_id) {
                    var editUrl = cdep.ajaxurl.replace('admin-ajax.php', 'post.php?post=' + item.product_id + '&action=edit');
                    // Update SKU cell (index 4 in the table)
                    var $skuCell = $row.find('td').eq(4);
                    $skuCell.html('<strong><a href="' + editUrl + '" target="_blank">' + escHtml(sku) + '</a></strong>');
                    // Update Name cell (index 5 in the table, if product_name was mapped)
                    var $nameCell = $row.find('td').eq(5);
                    var nameText = $nameCell.find('strong').text() || $nameCell.text().trim();
                    if (nameText) {
                        $nameCell.html('<a href="' + editUrl + '" target="_blank">' + escHtml(nameText) + '</a>');
                    }
                }
            }
            btn.prop('disabled', false).text('Procesar');
        }, function (msg) {
            btn.prop('disabled', false).text('Procesar');
        });
    });

    // === SINGLE PRODUCT AI GENERATE ===
    $(document).on('click', '.cdep-ai-generate-row', function () {
        var btn = $(this);
        var sku = btn.attr('data-sku');
        var $row = btn.closest('.cdep-product-row');

        if (!state.mapping || !state.mapping.sku) {
            var $msg = $('<p class="fwue-message error">Primero haz una vista previa</p>');
            $('#cdep-preview-result').prepend($msg);
            setTimeout(function () { $msg.remove(); }, 8000);
            return;
        }

        btn.prop('disabled', true).text('Generando...');

        ajax('cdep_ai_generate', {
            mapping: state.mapping,
            skus: [sku],
            ai_provider: cdep.ai_provider,
        }, function (data) {
            // Handle rate limit: show message to retry later
            if (data.rate_limited) {
                btn.prop('disabled', false).text('Generar con IA');
                var $msg = $('<p class="fwue-message error">Limite de peticiones de IA alcanzado. Espera 1 minuto y vuelve a intentarlo.</p>');
                $('#cdep-preview-result').prepend($msg);
                setTimeout(function () { $msg.remove(); }, 10000);
                return;
            }

            // Show errors in specific field cells
            if (data.errors && data.errors.length > 0) {
                $.each(data.errors, function (i, err) {
                    var $cell = $row.find('.cdep-field-cell-' + err.field);
                    if ($cell.length) {
                        $cell.html('<span class="cdep-badge cdep-badge-error" title="' + escHtml(err.message) + '">Error: ' + escHtml(err.message) + '</span>');
                    }
                    if (err.field === 'product_name') {
                        $row.find('td').eq(5).html('<span class="cdep-badge cdep-badge-error">Error: ' + escHtml(err.message) + '</span>');
                    }
                });
                btn.prop('disabled', false).text('Generar con IA');
                var $msg = $('<p class="fwue-message error">Error al generar contenido IA para ' + sku + '</p>');
                $('#cdep-preview-result').prepend($msg);
                setTimeout(function () { $msg.remove(); }, 8000);
                return;
            }

            if (data.data && data.data[sku]) {
                if (!state.aiGenerated) {
                    state.aiGenerated = {};
                }
                state.aiGenerated[sku] = data.data[sku];
                saveAiCache();

                // Re-run preview to get updated field data for this SKU
                ajax('cdep_update_preview', {
                    mapping: state.mapping,
                    ai_data: state.aiGenerated,
                    manual_data: state.manualData,
                }, function (previewData) {
                    state.products = previewData.products;

                    // Update the specific row cells with AI content buttons
                    $.each(previewData.products, function (i, p) {
                        if (p.sku === sku) {
                            $.each(p.fields, function (fieldKey, fd) {
                                var isAi = previewData.ai_fields && previewData.ai_fields.indexOf(fieldKey) !== -1;
                                if (isAi && fd && fd.new) {
                                    var $cell = $row.find('.cdep-field-cell-' + fieldKey);
                                    if ($cell.length) {
                                        $cell.html(
                                            '<button class="button button-small cdep-view-ai-content" data-sku="' + escHtml(sku) + '" data-field="' + fieldKey + '">Ver contenido generado con IA</button>' +
                                            ' <button class="button button-small cdep-ai-regenerate-field" data-sku="' + escHtml(sku) + '" data-field="' + fieldKey + '">Regenerar</button>'
                                        );
                                    }
                                }
                            });

                            // Also update product_name if it was AI
                            if (p.fields['product_name']) {
                                var isAiName = previewData.ai_fields && previewData.ai_fields.indexOf('product_name') !== -1;
                                if (isAiName && p.fields['product_name'].new) {
                                    $row.find('td').eq(5).html(
                                        '<button class="button button-small cdep-view-ai-content" data-sku="' + escHtml(sku) + '" data-field="product_name">Ver contenido generado con IA</button>' +
                                        ' <button class="button button-small cdep-ai-regenerate-field" data-sku="' + escHtml(sku) + '" data-field="product_name">Regenerar</button>'
                                    );
                                }
                            }
                        }
                    });

                    // If all AI fields generated, remove the action button
                    var allAiFields = [];
                    if (state.mapping) {
                        $.each(state.mapping, function (key, val) {
                            if (val === '__ai__') {
                                if (key.indexOf('create_') === 0) {
                                    allAiFields.push(key.replace('create_', ''));
                                } else {
                                    allAiFields.push(key);
                                }
                            }
                        });
                    }
                    if (hasAllAiFields(sku, allAiFields)) {
                        $row.find('.cdep-ai-generate-row').remove();
                    }

                    btn.prop('disabled', false).text('Generar con IA');
                    var $msg = $('<p class="fwue-message ok">Contenido generado para ' + sku + '</p>');
                    $('#cdep-preview-result').prepend($msg);
                    setTimeout(function () { $msg.remove(); }, 8000);
                }, function (msg) {
                    btn.prop('disabled', false).text('Generar con IA');
                    var $msg = $('<p class="fwue-message error">' + msg + '</p>');
                    $('#cdep-preview-result').prepend($msg);
                    setTimeout(function () { $msg.remove(); }, 8000);
                });
            }
        }, function (msg) {
            btn.prop('disabled', false).text('Generar con IA');
            var $msg = $('<p class="fwue-message error">' + msg + '</p>');
            $('#cdep-preview-result').prepend($msg);
            setTimeout(function () { $msg.remove(); }, 8000);
        });
    });

    // === PER-FIELD AI REGENERATE ===
    $(document).on('click', '.cdep-ai-regenerate-field', function () {
        var btn = $(this);
        var sku = btn.data('sku');
        var field = btn.data('field');
        var $row = btn.closest('.cdep-product-row');
        var $cell = btn.closest('td');

        btn.prop('disabled', true).text('Regenerando...');

        ajax('cdep_ai_generate', {
            mapping: state.mapping,
            skus: [sku],
            field: field,
            ai_provider: cdep.ai_provider,
        }, function (data) {
            if (data.data && data.data[sku] && data.data[sku][field]) {
                if (!state.aiGenerated) {
                    state.aiGenerated = {};
                }
                if (!state.aiGenerated[sku]) {
                    state.aiGenerated[sku] = {};
                }
                state.aiGenerated[sku][field] = data.data[sku][field];
                saveAiCache();

                // Re-run preview to update the cell
                ajax('cdep_update_preview', {
                    mapping: state.mapping,
                    ai_data: state.aiGenerated,
                    manual_data: state.manualData,
                }, function (previewData) {
                    $cell.html(
                        '<button class="button button-small cdep-view-ai-content" data-sku="' + escHtml(sku) + '" data-field="' + field + '">Ver contenido generado con IA</button>' +
                        ' <button class="button button-small cdep-ai-regenerate-field" data-sku="' + escHtml(sku) + '" data-field="' + field + '">Regenerar</button>'
                    );

                    // If all AI fields generated, remove the action button
                    var allAiFields = [];
                    if (state.mapping) {
                        $.each(state.mapping, function (key, val) {
                            if (val === '__ai__') {
                                if (key.indexOf('create_') === 0) {
                                    allAiFields.push(key.replace('create_', ''));
                                } else {
                                    allAiFields.push(key);
                                }
                            }
                        });
                    }
                    if (hasAllAiFields(sku, allAiFields)) {
                        $row.find('.cdep-ai-generate-row').remove();
                    }

                    btn.prop('disabled', false).text('Regenerar');
                }, function (msg) {
                    btn.prop('disabled', false).text('Regenerar');
                });
            } else {
                btn.prop('disabled', false).text('Regenerar');
            }
        }, function (msg) {
            btn.prop('disabled', false).text('Regenerar');
        });
    });

    // === PREVIEW TABS SWITCHING ===
    $(document).on('click', '.cdep-preview-tab', function () {
        var tab = $(this).data('tab');
        $('.cdep-preview-tab').removeClass('active');
        $(this).addClass('active');
        $('.cdep-preview-tab-content').removeClass('active');
        $('.cdep-preview-tab-content[data-tab="' + tab + '"]').addClass('active');
        return false;
    });

    // === TAB SWITCHING ===
    $(document).on('click', '.nav-tab', function () {
        var tab = $(this).data('tab');
        if (tab === 'mapping') {
            loadMapping();
        } else if (tab === 'browse') {
            if (!restoreFolderState()) {
                loadFiles('root');
            } else {
                loadFiles(state.currentFolder);
            }
        }
    });

    // === AI CONTENT MODAL ===
    $('body').append(
        '<div id="cdep-ai-modal" class="cdep-modal-overlay" style="display:none">' +
            '<div class="cdep-modal-content">' +
                '<div class="cdep-modal-header">' +
                    '<h3 id="cdep-ai-modal-title">Contenido generado con IA</h3>' +
                    '<button class="cdep-modal-close">&times;</button>' +
                '</div>' +
                '<div id="cdep-ai-modal-body" class="cdep-modal-body"></div>' +
            '</div>' +
        '</div>'
    );

    $(document).on('click', '.cdep-view-ai-content', function () {
        var sku = $(this).data('sku');
        var field = $(this).data('field');
        var content = '';
        if (state.aiGenerated && state.aiGenerated[sku] && state.aiGenerated[sku][field]) {
            content = state.aiGenerated[sku][field];
        } else if (state.products) {
            $.each(state.products, function (i, p) {
                if (p.sku === sku && p.fields[field]) {
                    content = p.fields[field].new || '';
                }
            });
        }

        var fieldLabels = {
            'product_name': 'Nombre del producto',
            'short_description': 'Descripción corta',
            'description': 'Descripción',
        };
        var label = fieldLabels[field] || field;
        $('#cdep-ai-modal-title').text(label + ' - SKU: ' + sku);
        $('#cdep-ai-modal-body').html(content);
        $('#cdep-ai-modal').show();
    });

    $(document).on('click', '.cdep-modal-close, .cdep-modal-overlay', function (e) {
        if (e.target === this || $(e.target).hasClass('cdep-modal-close')) {
            $('#cdep-ai-modal').hide();
        }
    });

    $(document).on('keydown', function (e) {
        if (e.key === 'Escape' && $('#cdep-ai-modal').is(':visible')) {
            $('#cdep-ai-modal').hide();
        }
    });

    // === EXPORT / IMPORT CONFIG ===

    $(document).on('click', '#cdep-export-config', function () {
        var keys = ['cdep_mapping_config', 'cdep_manual_data', 'cdep_ai_cache', 'cdep_ai_prompts', 'cdep_folder'];
        var data = {
            version: 1,
            exported_at: new Date().toISOString(),
            data: {}
        };
        for (var i = 0; i < keys.length; i++) {
            try {
                var raw = localStorage.getItem(keys[i]);
                if (raw) {
                    data.data[keys[i]] = JSON.parse(raw);
                }
            } catch (e) {}
        }
        var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'cdep-config-' + new Date().toISOString().slice(0, 10) + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    $(document).on('click', '#cdep-import-config', function () {
        $('#cdep-import-file').click();
    });

    $(document).on('change', '#cdep-import-file', function () {
        var file = this.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function (e) {
            try {
                var json = JSON.parse(e.target.result);
                if (!json.version || !json.data) {
                    showMessage('#cdep-mapping-container', 'Formato de archivo inválido', 'error');
                    return;
                }
                for (var key in json.data) {
                    if (json.data.hasOwnProperty(key)) {
                        try {
                            localStorage.setItem(key, JSON.stringify(json.data[key]));
                        } catch (e) {
                            showMessage('#cdep-mapping-container', 'Error al guardar en localStorage', 'error');
                            return;
                        }
                    }
                }
                showMessage('#cdep-mapping-container', 'Configuración importada correctamente. Recargando...', 'ok');
                setTimeout(function () { location.reload(); }, 1500);
            } catch (e) {
                showMessage('#cdep-mapping-container', 'Error al leer el archivo: ' + e.message, 'error');
            }
        };
        reader.readAsText(file);
        $(this).val('');
    });
});
