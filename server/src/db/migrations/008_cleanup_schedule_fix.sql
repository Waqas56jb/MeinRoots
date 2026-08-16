-- ---------------------------------------------------------------------------
-- 008 — let a running sweep schedule its successor
--
-- 007 guarded against duplicates with a unique index over ('queued','running').
-- That was wrong, and it stopped the cleanup from ever running twice.
--
-- The sweep reschedules itself from a finally block, which executes while its
-- own row is still status='running' — the queue only marks it 'succeeded'
-- after the handler returns. So the insert of the successor collided with the
-- running job under this index, raised 23505, was swallowed as "somebody else
-- already scheduled it", and nothing was ever queued again. Two sweeps ran on
-- 15 and 16 August and then the chain was simply dead; only a service restart
-- started it again, because the boot-time guard queues one.
--
-- Covering 'queued' alone is the rule that was actually wanted: at most one
-- sweep waiting to run, while the one currently running is free to queue the
-- next. Duplicates are still impossible, because a duplicate would be a second
-- queued row.
-- ---------------------------------------------------------------------------

DROP INDEX IF EXISTS jobs_single_scheduled_cleanup_idx;

CREATE UNIQUE INDEX IF NOT EXISTS jobs_single_queued_cleanup_idx
  ON jobs (type)
  WHERE type = 'candidates.cleanup_no_cv' AND status = 'queued';
