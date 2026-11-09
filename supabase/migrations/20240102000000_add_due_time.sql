-- Migration: Add due_time to tasks (Phase 3.5 Calendar Export)
-- Description: Adds a nullable due_time column to the tasks table for optional time-of-day assignment.

ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS due_time TIME;
