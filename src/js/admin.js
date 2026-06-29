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
            $sel.find('option:not(:first)').remove();
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
        };

        // Update fields (existing products): regular_price, sale_price, stock_quantity
        $('.cdep-field-select').each(function () {
            var field = $(this).data('field');
            var val = $(this).val();
            if (val) {
                mapping[field] = val;
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
                var target = $(this).find('.cdep-condition-row').data('condition');
                var $items = $(this).find('.cdep-condition-items .cdep-condition-item');
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
                // Do NOT add to config_vars since it's conditional
            } else if (selectedVal === '__manual__') {
                // Edicion Manual: set marker in mapping for per-row manual input
                if (label === 'marca') {
                    mapping['creation_brand'] = '__manual__';
                } else if (label === 'categoría') {
                    mapping['creation_category'] = '__manual__';
                }
            } else if (selectedVal) {
                // Map brand/category fields to mapping keys
                if (label === 'marca') {
                    mapping['creation_brand'] = selectedText;
                } else if (label === 'categoría') {
                    mapping['creation_category'] = selectedText;
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
            if (!isCond && !term) return;
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
                term: isCond ? '' : term,
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
            // Restore update fields
            $('.cdep-field-select').each(function () {
                var field = $(this).data('field');
                if (mapping[field]) {
                    $(this).val(mapping[field]);
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
            if (mapping['creation_category']) {
                $('#creation-category').val(mapping['creation_category']);
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
                        var $select = target === 'marca' ? $('#creation-brand') : $('#creation-category');
                        $select.val('__condicionar__');
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
    }

    // === CUSTOM TEMPLATE UI ===

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
        var $wrap = $(this).closest('.cdep-custom-template-wrap, .cdep-ai-prompt-wrap');
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
            var catOptions = $('#creation-category option').not('[value=""], [value="__condicionar__"]');
            catOptions.each(function () {
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
            + '<select class="cdep-attribute-term-select" style="width:100%"><option value="">— Término —</option><option value="__condicionar__">Condicionar</option></select>'
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
        // Keep empty option and __condicionar__, remove old terms
        $termSel.find('option').filter(function () {
            return $(this).val() !== '' && $(this).val() !== '__condicionar__';
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

    function renderProductsTable(products, mappedFields, productNameMapped, aiFields, manualFields, brandManual, categoryManual) {
        var html = '<div class="cdep-table-wrapper">';
        html += '<table class="wp-list-table widefat striped">';
        html += '<colgroup>';
        html += '<col style="width: 40px;">';
        html += '<col style="width: 110px;">';
        html += '<col style="width: 110px;">';
        html += '<col style="width: 70px;">';
        html += '<col style="width: auto;">';
        html += '<col style="width: auto;">';
        html += '<col style="width: auto;">';
        html += '<col style="width: auto;">';
        if (brandManual) {
            html += '<col style="width: auto;">';
        }
        $.each(mappedFields, function (i, f) {
            html += '<col style="width: auto;">';
        });
        html += '</colgroup>';
        html += '<thead><tr>';
        html += '<th style="width:40px"><input type="checkbox" class="cdep-select-all" checked></th>';
        html += '<th>Acción</th><th>Estado</th><th>Imagen</th><th>SKU</th><th>Nombre</th><th>Categorías</th><th>Atributos</th>';
        if (brandManual) {
            html += '<th>Marca</th>';
        }
        $.each(mappedFields, function (i, f) {
            html += '<th>' + escHtml(f.label) + '</th>';
        });
        html += '</tr></thead><tbody>';

        $.each(products, function (i, p) {
            var statusBadge = renderStatusBadge(p.status);
            html += '<tr class="cdep-product-row" data-sku="' + escHtml(p.sku) + '" data-status="' + p.status + '">';
            html += '<td><input type="checkbox" class="cdep-row-checkbox" value="' + escHtml(p.sku) + '" checked></td>';
            html += '<td>';
            html += '<div class="content-btn-procesing-in-table">';
            html += '<button class="button button-small cdep-process-single" data-sku="' + escHtml(p.sku) + '">Procesar</button>';
            if (aiFields && aiFields.length > 0) {
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
                    html += '<td class="cdep-field-cell-product_name"><button class="button button-small cdep-view-ai-content" data-sku="' + escHtml(p.sku) + '" data-field="product_name">Ver contenido generado con IA</button></td>';
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
            if (categoryManual) {
                var savedCat = '';
                if (state.manualData && state.manualData[p.sku] && state.manualData[p.sku]['__category__'] !== undefined) {
                    savedCat = state.manualData[p.sku]['__category__'];
                }
                html += '<td><input type="text" class="cdep-manual-input" data-sku="' + escHtml(p.sku) + '" data-field="__category__" value="' + escHtml(savedCat) + '" style="width:100%" placeholder="Categoría"></td>';
            } else {
                html += '<td>' + escHtml(p.categories) + '</td>';
            }
            var attrsHtml = '';
            if (p.attributes && p.attributes.length > 0) {
                attrsHtml = '<span class="cdep-attr-list">' + p.attributes.join('<br>') + '</span>';
            }
            html += '<td>' + attrsHtml + '</td>';
            if (brandManual) {
                var savedBrand = '';
                if (state.manualData && state.manualData[p.sku] && state.manualData[p.sku]['__brand__'] !== undefined) {
                    savedBrand = state.manualData[p.sku]['__brand__'];
                }
                html += '<td><input type="text" class="cdep-manual-input cdep-manual-brand" data-sku="' + escHtml(p.sku) + '" data-field="__brand__" value="' + escHtml(savedBrand) + '" style="width:100%" placeholder="Marca"></td>';
            }
            $.each(mappedFields, function (fi, f) {
                var fd = p.fields[f.key];
                var isAi = aiFields && aiFields.indexOf(f.key) !== -1;
                var isManual = manualFields && manualFields.indexOf(f.key) !== -1;
                var isEmpty = !fd || !fd.new || fd.new === '' || fd.new === null || fd.new === undefined;
                var useAutoManual = !isAi && !isManual && isEmpty && isAutoManualActive();
                if (isAi && (!fd || !fd.new)) {
                    html += '<td class="cdep-field-cell-' + f.key + '"><span class="cdep-badge cdep-badge-ai">Pendiente de generar</span></td>';
                } else if (isAi) {
                    html += '<td class="cdep-field-cell-' + f.key + '"><button class="button button-small cdep-view-ai-content" data-sku="' + escHtml(p.sku) + '" data-field="' + f.key + '">Ver contenido generado con IA</button></td>';
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

        ajax('cdep_refresh_cache', {}, function (data) {
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
        }, function (data) {
            window.cdepParsedData = data;
            clearAiCache();
            clearManualData();
            $('#cdep-preview-result').html('');
            loadMapping();
            showMessage('#cdep-mapping-container', 'Encabezados actualizados (fila ' + headerRow + ')', 'ok');
            btn.prop('disabled', false).text('Aplicar');
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
            if (state.mapping.hasOwnProperty(key) && key.indexOf('create_') === 0 && state.mapping[key] === '__manual__') {
                manualFields.push(key.replace('create_', ''));
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
                html += renderProductsTable(existingProducts, updateMappedFields, updateProductNameMapped, [], []);
                html += '<hr>';
                html += '<p><button id="cdep-start-update" class="button button-primary">Iniciar Actualización Masiva</button></p>';
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
                html += '<p>';
                html += '<button id="cdep-start-create" class="button button-primary">Iniciar Creación Masiva</button>';
                if (hasAiFields) {
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

        var btn = $(this);
        var totalSkus = checkedSkus.length;
        var processedCount = 0;
        var allErrors = [];

        btn.prop('disabled', true).text('Generando...');
        $('#cdep-start-create').prop('disabled', true);
        $('#cdep-create-progress').show();
        $('#cdep-create-progress .cdep-progress-fill').css('width', '0%');
        $('#cdep-create-progress .cdep-progress-text').text('0 / ' + totalSkus + ' productos generados');

        function processNext(idx) {
            if (idx >= checkedSkus.length) {
                btn.prop('disabled', false).text('Generar contenido con IA');
                $('#cdep-start-create').prop('disabled', false);
                $('#cdep-create-progress .cdep-progress-text').text('Completado: ' + processedCount + ' generados');

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
                if (!state.aiGenerated) {
                    state.aiGenerated = {};
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
                                $cell.html('<button class="button button-small cdep-view-ai-content" data-sku="' + escHtml(sku) + '" data-field="' + fk + '">Ver contenido generado con IA</button>');
                            }
                        });
                        var isAiName = aiFields.indexOf('product_name') !== -1;
                        if (isAiName && state.aiGenerated[sku] && state.aiGenerated[sku]['product_name']) {
                            $row.find('td').eq(5).html('<button class="button button-small cdep-view-ai-content" data-sku="' + escHtml(sku) + '" data-field="product_name">Ver contenido generado con IA</button>');
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

    $(document).on('click', '#cdep-save-manual', function () {
        var btn = $(this);
        btn.prop('disabled', true).text('Guardando...');

        // Collect all manual inputs from the create tab
        var manualData = {};
        $('#cdep-preview-create-content .cdep-manual-input').each(function () {
            var sku = $(this).data('sku');
            var field = $(this).data('field');
            var value = $(this).val();
            if (!manualData[sku]) {
                manualData[sku] = {};
            }
            manualData[sku][field] = value;
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

        if (!mapping || !mapping.sku) {
            showMessage('#cdep-update-result', 'Primero haz una vista previa', 'error');
            return;
        }

        btn.prop('disabled', true).text('Procesando...');

        ajax('cdep_update_single', {
            sku: sku,
            mapping: mapping,
            ai_data: state.aiGenerated,
            manual_data: state.manualData,
        }, function (data) {
            if (data.processed_skus && data.processed_skus.length > 0) {
                var status = data.processed_skus[0].status;

                // Update status badge
                $row.attr('data-status', status);
                $row.find('.cdep-status-cell').html(renderStatusBadge(status));

                // Flatten diff cells — replace with just the new value
                $row.find('.cdep-diff').each(function () {
                    var newVal = $(this).find('.cdep-new-value').text();
                    $(this).replaceWith('<strong>' + newVal + '</strong>');
                });
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
                                        $cell.html('<button class="button button-small cdep-view-ai-content" data-sku="' + escHtml(sku) + '" data-field="' + fieldKey + '">Ver contenido generado con IA</button>');
                                    }
                                }
                            });

                            // Also update product_name if it was AI
                            if (p.fields['product_name']) {
                                var isAiName = previewData.ai_fields && previewData.ai_fields.indexOf('product_name') !== -1;
                                if (isAiName && p.fields['product_name'].new) {
                                    $row.find('td').eq(5).html('<button class="button button-small cdep-view-ai-content" data-sku="' + escHtml(sku) + '" data-field="product_name">Ver contenido generado con IA</button>');
                                }
                            }
                        }
                    });

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
});
