<?php
defined('ABSPATH') || exit;

use franciscoblancojn\wordpress_utils\FWUPage;

add_action('admin_menu', function () {
    add_menu_page(
        'Connexion Drive Excel Product',
        'Drive Excel Product',
        'manage_options',
        CDEP_KEY,
        'CDEP_render_page',
        'dashicons-update'
    );
});

add_action('admin_enqueue_scripts', function ($hook) {
    if ($hook !== 'toplevel_page_' . CDEP_KEY) {
        return;
    }

    wp_enqueue_style('cdep-admin', CDEP_URL . 'src/css/admin.css', [], filemtime(CDEP_DIR . 'src/css/admin.css'));
    wp_enqueue_script('cdep-admin', CDEP_URL . 'src/js/admin.js', ['jquery'], filemtime(CDEP_DIR . 'src/js/admin.js'), true);
    wp_localize_script('cdep-admin', 'cdep', [
        'ajaxurl' => admin_url('admin-ajax.php'),
        'nonce' => wp_create_nonce('cdep_nonce'),
        'is_connected' => CDEP_DRIVE::isConnected(),
        'config' => CDEP_DRIVE::getConfig(),
        'selected_file' => CDEP_DRIVE::getSelectedFile(),
        'oauth_url' => admin_url('admin.php?page=' . CDEP_KEY),
    ]);
});

function CDEP_render_page() {
    $config = CDEP_DRIVE::getConfig();
    $isConnected = CDEP_DRIVE::isConnected();
    $selected = CDEP_DRIVE::getSelectedFile();

    $activeTab = isset($_GET['tab']) ? sanitize_key($_GET['tab']) : 'connect';

    $tabs = [
        ['key' => 'connect', 'title' => 'Conectar'],
        ['key' => 'browse', 'title' => 'Explorar'],
        ['key' => 'mapping', 'title' => 'Mapear'],
        ['key' => 'update', 'title' => 'Actualizar'],
    ];

    echo FWUPage::css();
?>
<div id="page-<?= CDEP_KEY ?>" class="wrap">
    <h1>Connexion Drive Excel Product</h1>
    <?php FWUPage::tabs($tabs, $activeTab); ?>
    <?php foreach ($tabs as $tag): ?>
        <div class="tab-content <?= $tag['key'] === $activeTab ? 'nav-tab-active' : '' ?>" id="<?= $tag['key'] ?>">
            <?php require CDEP_DIR . 'src/page/sections/' . $tag['key'] . '.php'; ?>
        </div>
    <?php endforeach; ?>
</div>
<?php
    echo FWUPage::js(CDEP_KEY);
}
