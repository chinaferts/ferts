-- Migration: Add submitted_by column to inspections table
-- Date: 2024

-- Add submitted_by column if not exists (for production deployment)
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS submitted_by VARCHAR(255);
