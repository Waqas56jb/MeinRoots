-- =============================================================================
-- Consent records
--
-- Until now a single `users.gdpr_consent_at` timestamp carried the whole of
-- what a candidate had agreed to. That is enough to answer "did they tick the
-- box", and nothing else. It cannot say which document version they saw, it
-- cannot hold six separate decisions, and it has nowhere to record a
-- withdrawal — so honouring "I no longer want my profile shown to employers"
-- would have meant destroying the evidence that consent was ever given.
--
-- GDPR Article 7(1) puts the burden of proof on us: we must be able to
-- demonstrate that a person consented. Article 7(3) gives them the right to
-- withdraw it as easily as they gave it. Those two together force an
-- append-only log rather than a mutable flag.
--
-- So: every decision is a row. A withdrawal is a new row with granted = false,
-- never an update or a delete. Current state is the newest row per type.
-- =============================================================================

-- The six decisions the registration form asks for. Three are required to hold
-- an account at all; three are genuinely optional and refusing them costs the
-- candidate nothing, which is what makes them valid consent rather than a
-- condition of service.
CREATE TYPE consent_type AS ENUM (
  'terms',             -- required: the Subscription Terms & Conditions
  'privacy',           -- required: acknowledgement of the Privacy Policy
  'data_processing',   -- required: processing personal data for the service
  'employer_sharing',  -- optional: presenting the profile to employers
  'job_alerts',        -- optional: opportunity and career-service messages
  'marketing'          -- optional: marketing communications
);

CREATE TABLE user_consents (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        consent_type NOT NULL,
  granted     boolean      NOT NULL,
  -- Which text they were shown. Without this, proving consent proves nothing:
  -- the terms can change, and a record that says only "agreed" cannot say to
  -- what. Re-acceptance after a material change appends rows at the new version.
  doc_version text         NOT NULL,
  -- 'registration' | 'settings' — where the decision was made. A withdrawal
  -- from the settings page and an original tick at signup are both evidence,
  -- but they are not the same kind of evidence.
  source      text         NOT NULL CHECK (source IN ('registration', 'settings', 'subscription')),
  ip          inet,
  user_agent  text,
  created_at  timestamptz  NOT NULL DEFAULT now()
);

-- The only query that runs on the hot path: the newest row per type for one
-- user. DESC on created_at so the current state is the first row scanned.
CREATE INDEX user_consents_current_idx ON user_consents (user_id, type, created_at DESC);

-- Deliberately no UNIQUE constraint on (user_id, type): the whole point is that
-- a person may grant, withdraw and grant again, and every one of those has to
-- survive as a separate fact.

COMMENT ON TABLE user_consents IS
  'Append-only consent log. A withdrawal is a new row with granted = false; rows are never updated or deleted while the user exists.';
