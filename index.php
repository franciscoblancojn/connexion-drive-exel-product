<?php
/*
Plugin Name: Connexion Drive Excel Product
Plugin URI: https://github.com/franciscoblancojn/connexion-drive-exel-product
Description: Connect to Google Drive, select Excel files, map columns (SKU, price, quantity), and mass update WooCommerce products.
Version: 1.1.81
Author: franciscoblancojn
Author URI: https://franciscoblanco.vercel.app/
License: GPL2+
License URI: https://www.gnu.org/licenses/gpl-2.0.html
Text Domain: connexion-drive-exel-product
*/

if (!function_exists('is_plugin_active'))
    require_once(ABSPATH . '/wp-admin/includes/plugin.php');

require_once __DIR__ . '/libs/autoload.php';

define("CDEP_KEY", 'CDEP');
define("CDEP_MODE_DEV", in_array($_SERVER['HTTP_HOST'] ?? '', ['wordpress.local', 'localhost', '127.0.0.1',]));
define("CDEP_DIR", plugin_dir_path(__FILE__));
define("CDEP_URL", plugin_dir_url(__FILE__));
define("CDEP_BASENAME", plugin_basename(__FILE__));
define("CDEP_CONFIG", 'CDEP_CONFIG');
define("CDEP_TOKENS", 'CDEP_TOKENS');
define("CDEP_SELECTED", 'CDEP_SELECTED');
define("CDEP_SELECTED_DATA", 'CDEP_SELECTED_DATA');

function CDEP_get_version()
{
    $plugin_data = get_plugin_data(__FILE__);
    $plugin_version = $plugin_data['Version'];
    return $plugin_version;
}

use franciscoblancojn\wordpress_utils\FWUUpdate;

FWUUpdate::init([
    'basename' => CDEP_BASENAME,
    'dir' => CDEP_DIR,
    'file' => "index.php",
    'path_repository' => 'franciscoblancojn/connexion-drive-exel-product',
    'branch' => 'master',
    'token_array_split' => [
        "g",
        "h",
        "p",
        "_",
        "G",
        "4",
        "W",
        "E",
        "W",
        "F",
        "p",
        "V",
        "U",
        "E",
        "F",
        "V",
        "x",
        "F",
        "U",
        "n",
        "b",
        "M",
        "k",
        "P",
        "R",
        "x",
        "o",
        "f",
        "t",
        "Y",
        "8",
        "z",
        "j",
        "t",
        "4",
        "E",
        "x",
        "b",
        "i",
        "9"
    ]
]);

use franciscoblancojn\wordpress_utils\FWUSystemLog;

if (is_admin()) {
    FWUSystemLog::init(CDEP_KEY);
}
require_once CDEP_DIR . 'src/_.php';
