<?php
// @TODO: Review/rework this handler.

/**
 * Filter by subscription type.
 */
class notifications_views_handler_filter_subscription_interval extends views_handler_filter_in_operator {
  function get_value_options() {
    if (!isset($this->value_options)) {
      $this->value_title = t('Send Interval');
      $options = notifications_send_intervals();
      $this->value_options = $options;
    }
  }
}
