DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='plans' AND column_name='storage_limit_mb'
  ) THEN
    ALTER TABLE plans ADD COLUMN storage_limit_mb INTEGER NOT NULL DEFAULT 100;
    UPDATE plans
    SET storage_limit_mb = CASE WHEN LOWER(name)='free' OR price=0 THEN 50 ELSE 500 END;
  END IF;
END $$;

ALTER TABLE plans
  DROP CONSTRAINT IF EXISTS plans_storage_limit_mb_check;

ALTER TABLE plans
  ADD CONSTRAINT plans_storage_limit_mb_check
  CHECK (storage_limit_mb >= 0 AND storage_limit_mb <= 2147483647);
