-- =============================================================================
-- Email delivery, address verification, and candidate edits to the AI profile.
-- =============================================================================

-- ------------------------- email address verification ------------------------
-- Same shape as password_resets: only the sha256 of the token is stored, so a
-- database dump cannot be replayed as a set of live verification links.

CREATE TABLE email_verifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email       citext      NOT NULL,   -- the address being proved, not necessarily users.email today
  token_hash  text        NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX email_verifications_user_idx ON email_verifications (user_id) WHERE used_at IS NULL;

-- ------------------------------ outbound email -------------------------------
-- Every message the platform tries to send, whether or not it succeeded.
--
-- Without this, "did the candidate get the reset link?" is unanswerable, and a
-- silently misconfigured SMTP server looks exactly like a working one.

CREATE TYPE email_status AS ENUM ('queued', 'sent', 'failed', 'skipped');

CREATE TABLE outbound_emails (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES users(id) ON DELETE SET NULL,
  to_email     citext       NOT NULL,
  template     text         NOT NULL,
  locale       text         NOT NULL DEFAULT 'en',
  subject      text         NOT NULL,
  status       email_status NOT NULL DEFAULT 'queued',
  provider_id  text,                    -- message id returned by the SMTP server
  error        text,
  attempts     integer      NOT NULL DEFAULT 0,
  created_at   timestamptz  NOT NULL DEFAULT now(),
  sent_at      timestamptz
);
CREATE INDEX outbound_emails_created_idx ON outbound_emails (created_at DESC);
CREATE INDEX outbound_emails_status_idx  ON outbound_emails (status) WHERE status <> 'sent';

-- Candidates choose whether to hear from us about their own analysis. Marketing
-- consent is a separate question and deliberately not implied by this one.
ALTER TABLE users ADD COLUMN notify_by_email boolean NOT NULL DEFAULT true;

-- ---------------------- candidate edits to the AI profile --------------------
--
-- The profile is AI-extracted, and the admin queue is driven by how confident
-- that extraction was. Letting a candidate overwrite those rows silently would
-- destroy the signal — a hand-typed row would look like a confidently parsed
-- one. So each row now records who last touched it, and every change is kept
-- with its before/after in profile_edits.

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profile_experiences', 'profile_education', 'profile_certifications',
    'profile_skills', 'profile_languages'
  ] LOOP
    EXECUTE format(
      'ALTER TABLE %I
         ADD COLUMN source text NOT NULL DEFAULT ''ai''
           CHECK (source IN (''ai'', ''candidate'', ''admin'')),
         ADD COLUMN edited_at timestamptz,
         ADD COLUMN edited_by uuid REFERENCES users(id) ON DELETE SET NULL', t);
  END LOOP;
END $$;

CREATE TABLE profile_edits (
  id          bigserial PRIMARY KEY,
  profile_id  uuid NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  entity_type text NOT NULL,          -- 'experience', 'skill', ...
  entity_id   uuid,                   -- null once the row itself is deleted
  action      text NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  -- Full row snapshots. The admin needs to see what the AI originally read,
  -- even after the candidate has corrected it.
  before      jsonb,
  after       jsonb,
  actor_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX profile_edits_profile_idx ON profile_edits (profile_id, created_at DESC);

-- A re-analysis replaces the AI rows; anything the candidate wrote must survive
-- that, so the repository filters on this. Kept as a view for the admin console
-- and for anyone reading the schema directly.
CREATE VIEW profile_edit_counts AS
SELECT profile_id, count(*)::int AS edit_count, max(created_at) AS last_edit_at
  FROM profile_edits
 GROUP BY profile_id;
