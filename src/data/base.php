<?php
defined('ABSPATH') || exit;

class CDEP_USE_DATA_BASE {
    protected $KEY = '';
    protected $DATA = [];

    public function __construct() {
        $this->onLoad();
    }

    public function get() {
        return $this->DATA;
    }

    public function set($DATA) {
        $this->DATA = $DATA;
        $this->onSave();
    }

    public function setField($k, $v) {
        $this->DATA[$k] = $v;
        $this->onSave();
    }

    public function add($DATA) {
        $this->DATA = array_merge($this->DATA, $DATA);
        $this->onSave();
    }

    protected function onLoad() {
        $this->DATA = get_option($this->KEY, []);
    }

    protected function onSave() {
        update_option($this->KEY, $this->DATA);
    }
}
