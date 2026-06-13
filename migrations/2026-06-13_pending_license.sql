-- Migration: 2026-06-13 — Pending License workflow tracking
-- Adds two columns to the leads table to drive the "Holding → Pending License"
-- decision UI and the holding-tab unread notification badge.
--
--   pending_license_status  NULL = unactioned | 'applying' | 'waiting'
--   pending_license_unread  1 = unread/unactioned, 0 = actioned or not pending_license

ALTER TABLE leads ADD COLUMN pending_license_status TEXT DEFAULT NULL;
ALTER TABLE leads ADD COLUMN pending_license_unread INTEGER DEFAULT 0;
