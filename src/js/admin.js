jQuery(function ($) {
    const imageProductDefualt = `<img src="https://woocommerce.aveonline.co/wp-content/uploads/woocommerce-placeholder-150x150.png" width="40" height="40" style="object-fit:cover;border-radius:4px">`
    var state = {
        currentFolder: 'root',
        folderHistory: [],
        headers: [],
        mapping: {},
        totalRows: 0,
        selectedFileId: '',
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
            // Keep first options: "— No mapear —" and "Personalizar"
            while ($sel.find('option').length > 2) {
                $sel.find('option:last').remove();
            }
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

        restoreMappingConfig();
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
                } else {
                    mapping['create_' + field] = val;
                }
            }
        });

        // Creation config
        var brand = $('#creation-brand').val();
        if (brand) {
            mapping['creation_brand'] = brand;
        }

        return mapping;
    }

    function saveMappingConfig(mapping) {
        try {
            localStorage.setItem('cdep_mapping_config', JSON.stringify(mapping));
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
                    if (val.indexOf('custom:') === 0) {
                        $(this).val('__custom__');
                        var $td = $(this).closest('td');
                        $td.find('.cdep-custom-template-input').val(val.substring(7));
                        $td.find('.cdep-custom-template-wrap').show();
                    } else {
                        $(this).val(val);
                    }
                }
            });
            // Restore creation config
            if (mapping['creation_brand']) {
                $('#creation-brand').val(mapping['creation_brand']);
            }
        } catch (e) {}
    }

    // === CUSTOM TEMPLATE UI ===

    $(document).on('change', '.cdep-field-select-create', function () {
        var val = $(this).val();
        var $wrap = $(this).closest('td').find('.cdep-custom-template-wrap');
        if (val === '__custom__') {
            $wrap.show();
        } else {
            $wrap.hide();
        }
    });

    $(document).on('click', '.cdep-template-variable-btn', function () {
        var $list = $(this).closest('.cdep-custom-template-wrap').find('.cdep-template-variables-list');
        if ($list.is(':visible')) {
            $list.hide();
            return;
        }
        var headers = window.cdepParsedData ? window.cdepParsedData.headers : [];
        var html = '';
        $.each(headers, function (i, h) {
            html += '<a href="#" class="cdep-template-variable-item" data-name="' + escHtml(h.name) + '">' + escHtml(h.name) + '</a>';
        });
        $list.html(html).show();
    });

    $(document).on('click', '.cdep-template-variable-item', function () {
        var name = $(this).data('name');
        var $input = $(this).closest('.cdep-custom-template-wrap').find('.cdep-custom-template-input');
        var input = $input[0];
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
        if (!$(e.target).closest('.cdep-custom-template-wrap').length) {
            $('.cdep-template-variables-list').hide();
        }
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

    function renderProductsTable(products, mappedFields, productNameMapped) {
        var html = '<div class="cdep-table-wrapper">';
        html += '<table class="wp-list-table widefat fixed striped">';
        html += '<colgroup>';
        html += '<col style="width: 40px;">';
        html += '<col style="width: 90px;">';
        html += '<col style="width: 110px;">';
        html += '<col style="width: 70px;">';
        html += '<col style="width: auto;">';
        html += '<col style="width: auto;">';
        html += '<col style="width: auto;">';
        $.each(mappedFields, function (i, f) {
            html += '<col style="width: auto;">';
        });
        html += '</colgroup>';
        html += '<thead><tr>';
        html += '<th style="width:40px"><input type="checkbox" class="cdep-select-all" checked></th>';
        html += '<th>Acción</th><th>Estado</th><th>Imagen</th><th>SKU</th><th>Nombre</th><th>Categorías</th>';
        $.each(mappedFields, function (i, f) {
            html += '<th>' + escHtml(f.label) + '</th>';
        });
        html += '</tr></thead><tbody>';

        $.each(products, function (i, p) {
            var statusBadge = renderStatusBadge(p.status);
            html += '<tr class="cdep-product-row" data-sku="' + escHtml(p.sku) + '" data-status="' + p.status + '">';
            html += '<td><input type="checkbox" class="cdep-row-checkbox" value="' + escHtml(p.sku) + '" checked></td>';
            html += '<td><button class="button button-small cdep-process-single" data-sku="' + escHtml(p.sku) + '">Procesar</button></td>';
            html += '<td class="cdep-status-cell">' + statusBadge + '</td>';
            html += '<td>' + (p.image || imageProductDefualt) + '</td>';
            if (p.exists && p.product_id) {
                var editUrl = cdep.ajaxurl.replace('admin-ajax.php', 'post.php?post=' + p.product_id + '&action=edit');
                html += '<td><strong><a href="' + editUrl + '" target="_blank">' + escHtml(p.sku) + '</a></strong></td>';
            } else {
                html += '<td><strong>' + escHtml(p.sku) + '</strong></td>';
            }
            if (productNameMapped && p.fields['product_name']) {
                html += '<td>' + renderFieldCell(p.fields['product_name'], p.exists) + '</td>';
            } else {
                html += '<td>' + escHtml(p.name) + '</td>';
            }
            html += '<td>' + escHtml(p.categories) + '</td>';
            $.each(mappedFields, function (fi, f) {
                var fd = p.fields[f.key];
                html += '<td>' + (fd ? renderFieldCell(fd, p.exists) : '') + '</td>';
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
        }, function (data) {
            var html = '<div class="cdep-preview-summary">';
            html += '<p><strong>Total filas con SKU:</strong> ' + data.total + ' | ';
            html += '<strong>Existentes:</strong> ' + data.found + ' | ';
            html += '<strong>Nuevos:</strong> ' + data.new_count + '</p>';
            html += '</div>';

            if (data.products && data.products.length > 0) {
                var mappedFields = [];
                var productNameMapped = false;
                if (data.field_labels) {
                    $.each(data.field_labels, function (key, label) {
                        if (key === 'product_name') {
                            productNameMapped = true;
                        } else {
                            mappedFields.push({ key: key, label: label });
                        }
                    });
                }

                // Split products into existing and new
                var existingProducts = [];
                var newProducts = [];
                $.each(data.products, function (i, p) {
                    if (p.exists) {
                        existingProducts.push(p);
                    } else {
                        newProducts.push(p);
                    }
                });

                html += '<h3>Productos a procesar</h3>';
                html += '<div class="cdep-preview-tabs-wrapper">';
                html += '<div class="cdep-preview-tabs">';
                html += '<a href="#" class="cdep-preview-tab active" data-tab="update">Productos a actualizar (' + existingProducts.length + ')</a>';
                html += '<a href="#" class="cdep-preview-tab" data-tab="create">Productos a crear (' + newProducts.length + ')</a>';
                html += '</div>';

                // Update tab
                html += '<div class="cdep-preview-tab-content active" id="cdep-preview-update-content" data-tab="update">';
                if (existingProducts.length > 0) {
                    html += renderProductsTable(existingProducts, mappedFields, productNameMapped);
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
                    html += renderProductsTable(newProducts, mappedFields, productNameMapped);
                    html += '<hr>';
                    html += '<p><button id="cdep-start-create" class="button button-primary">Iniciar Actualización Masiva</button></p>';
                } else {
                    html += '<p>No hay productos nuevos para crear.</p>';
                }
                html += '<div id="cdep-create-progress" style="display:none">';
                html += '<div class="cdep-progress-bar"><div class="cdep-progress-fill" style="width:0%"></div></div>';
                html += '<p class="cdep-progress-text">0 / ' + newProducts.length + ' productos procesados</p>';
                html += '</div>';
                html += '<div id="cdep-create-result"></div>';
                html += '</div>';

                html += '</div>'; // .cdep-preview-tabs-wrapper
            }

            html += '<p>Archivo: <strong>' + escHtml(data.file_name) + '</strong></p>';

            state.products = data.products;

            $('#cdep-preview-result').html(html);
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

    function runBatchUpdate(containerId, buttonId, progressId, resultId, mapping) {
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
                    resultHtml += '<div class="cdep-table-scroll"><table class="wp-list-table widefat fixed striped">';
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

            ajax('cdep_update_batch_skus', {
                skus: batches[idx],
                mapping: mapping,
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
        runBatchUpdate('cdep-preview-update-content', 'cdep-start-update', 'cdep-update-progress', 'cdep-update-result', state.mapping);
    });

    $(document).on('click', '#cdep-start-create', function () {
        runBatchUpdate('cdep-preview-create-content', 'cdep-start-create', 'cdep-create-progress', 'cdep-create-result', state.mapping);
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

    var currentQueryString = window.location.search;
    if (currentQueryString.indexOf('code=') !== -1 || currentQueryString.indexOf('tab=connect') !== -1) {
    }
});
