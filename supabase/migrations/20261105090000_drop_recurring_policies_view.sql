-- ==============================================================================
-- Budget Bubby: Drop recurring_policies compatibility view
-- The temporary view from 20261104120000_recurring_items.sql let the previous
-- frontend keep using .from('recurring_policies') during rollout. Every client
-- now uses recurring_items, so the view is no longer needed.
-- Apply only after the recurring-items frontend is deployed and all devices
-- have reloaded it.
-- ==============================================================================

drop view if exists recurring_policies;
