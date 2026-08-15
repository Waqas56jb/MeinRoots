-- ---------------------------------------------------------------------------
-- 007 — automatic removal of candidate accounts that never uploaded a CV
--
-- Two indexes and one guard. No new tables: the cleanup is an ordinary row in
-- the existing jobs queue, run by the existing worker.
-- ---------------------------------------------------------------------------

-- The eligibility scan is "candidates, not deleted, older than a day". The
-- existing users_role_idx has no created_at, so that scan had to sort every
-- candidate; this partial index answers it in one range read and stays small
-- because it only covers live candidate rows.
CREATE INDEX IF NOT EXISTS users_candidate_created_idx
  ON users (created_at)
  WHERE role = 'candidate' AND deleted_at IS NULL;

-- The other half of the scan asks, per candidate, "is there any cv_documents
-- row at all". cv_documents_user_idx is on (user_id, uploaded_at DESC) and
-- already answers that, so nothing is added for it.

-- Exactly one cleanup may be scheduled at a time.
--
-- The job reschedules itself when it finishes, and the worker schedules one at
-- boot in case that chain was ever broken. Both paths guard with a NOT EXISTS,
-- but two workers could still pass the guard at the same instant, so the rule
-- is written where a race cannot get around it. Without this a restart loop
-- would quietly build up a queue of identical cleanups.
CREATE UNIQUE INDEX IF NOT EXISTS jobs_single_scheduled_cleanup_idx
  ON jobs (type)
  WHERE type = 'candidates.cleanup_no_cv' AND status IN ('queued', 'running');
