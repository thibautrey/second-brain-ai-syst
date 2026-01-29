-- Add WATCH_RESOURCE action to TaskActionType enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'WATCH_RESOURCE'
      AND enumtypid = (
        SELECT oid FROM pg_type WHERE typname = '\"TaskActionType\"'
      )
  ) THEN
    ALTER TYPE "TaskActionType" ADD VALUE 'WATCH_RESOURCE';
  END IF;
END
$$;
