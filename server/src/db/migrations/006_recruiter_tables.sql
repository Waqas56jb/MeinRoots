-- =============================================================================
-- Milestone 2 tables.
--
-- Split from 005 because PostgreSQL will not let a value added to an enum be
-- used in the same transaction that added it, and the migration runner wraps
-- each file in one. 005 adds the values; this file may use them.
-- =============================================================================

-- ---------------------------- candidate reference ---------------------------
--
-- The handle a recruiter sees instead of a name.
--
-- It is a real column rather than a value derived at query time, because it has
-- to be stable: a recruiter who saved "MR-1042" last week must find the same
-- person this week, and it is what appears in the audit log, in the request
-- record and in the console's monitoring view — none of which should hold a
-- name they do not need.
CREATE SEQUENCE IF NOT EXISTS candidate_reference_seq START 1000;

ALTER TABLE candidate_profiles
  ADD COLUMN IF NOT EXISTS reference text;

UPDATE candidate_profiles
   SET reference = 'MR-' || nextval('candidate_reference_seq')
 WHERE reference IS NULL;

ALTER TABLE candidate_profiles
  ALTER COLUMN reference SET DEFAULT 'MR-' || nextval('candidate_reference_seq'),
  ALTER COLUMN reference SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS candidate_profiles_reference_key
  ON candidate_profiles (reference);

-- --------------------------------- companies --------------------------------

CREATE TYPE company_verification AS ENUM (
  'pending', 'verified', 'info_required', 'rejected'
);

CREATE TABLE companies (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name          text NOT NULL CHECK (length(btrim(legal_name)) > 0),
  trading_name        text,
  website             text,
  country             text NOT NULL,
  city                text,
  industry            text,
  size                text,
  registration_number text,
  vat_id              text,
  description         text,

  verification_status company_verification NOT NULL DEFAULT 'pending',
  verification_note   text,
  verified_at         timestamptz,
  verified_by         uuid REFERENCES users(id) ON DELETE SET NULL,

  -- Deactivation rather than deletion. A company with signed requests and an
  -- audit trail behind it cannot simply be removed without taking the record of
  -- what it did with it.
  deactivated_at      timestamptz,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX companies_verification_idx ON companies (verification_status)
  WHERE deactivated_at IS NULL;
CREATE INDEX companies_created_idx ON companies (created_at DESC);
-- Case-insensitive search on the two names an admin would actually type.
CREATE INDEX companies_name_search_idx ON companies
  (lower(legal_name) text_pattern_ops, lower(coalesce(trading_name, '')) text_pattern_ops);

CREATE TRIGGER companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------ company members ------------------------------

CREATE TYPE member_status AS ENUM ('invited', 'active', 'disabled');

CREATE TABLE company_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Mirrors users.role for this company. Kept here as well because membership
  -- is what the authorisation check reads: a user's global role says what kind
  -- of account it is, this says what they may do inside this company.
  role       user_role NOT NULL DEFAULT 'recruiter'
             CHECK (role IN ('recruiter', 'company_admin')),
  status     member_status NOT NULL DEFAULT 'active',
  invited_by uuid REFERENCES users(id) ON DELETE SET NULL,
  invited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One seat per person per company, and — because every recruiter endpoint
-- resolves the caller's company from this table — one company per person.
CREATE UNIQUE INDEX company_members_user_key ON company_members (user_id);
CREATE INDEX company_members_company_idx ON company_members (company_id, status);

CREATE TRIGGER company_members_updated_at BEFORE UPDATE ON company_members
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------- plans -----------------------------------
--
-- Prices are integer minor units. 50.00 EUR is 5000, never 50.0 — a float here
-- is a rounding error in somebody's invoice.
--
-- A NULL price means "not priced yet" and is a legitimate state: Premium is
-- sold on request and must not be shown a number nobody agreed to.

CREATE TYPE billing_interval AS ENUM ('month', 'year');

CREATE TABLE plans (
  key         text PRIMARY KEY,
  name        text NOT NULL,
  description text,
  price_cents integer CHECK (price_cents IS NULL OR price_cents >= 0),
  currency    char(3) NOT NULL DEFAULT 'EUR',
  interval    billing_interval,
  trial_days  integer NOT NULL DEFAULT 0 CHECK (trial_days >= 0),
  -- Set once the plan exists at the payment provider. Absent means this plan
  -- cannot be checked out yet, which the API reports rather than guessing.
  provider_price_id text,
  enabled     boolean NOT NULL DEFAULT true,
  highlighted boolean NOT NULL DEFAULT false,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER plans_updated_at BEFORE UPDATE ON plans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- What each plan may do. Rows here are the entitlement map the API hands the
-- portal, so adding a capability is an INSERT rather than a deploy.
CREATE TABLE plan_features (
  plan_key text NOT NULL REFERENCES plans(key) ON DELETE CASCADE,
  feature  text NOT NULL,
  enabled  boolean NOT NULL DEFAULT true,
  -- Optional numeric ceiling for the features that have one (searches per day,
  -- open requests). NULL means no limit rather than zero.
  limit_value integer CHECK (limit_value IS NULL OR limit_value >= 0),
  PRIMARY KEY (plan_key, feature)
);

-- ------------------------------- subscriptions -------------------------------

CREATE TYPE subscription_status AS ENUM (
  'trialing', 'active', 'past_due', 'cancelled', 'expired'
);

CREATE TABLE subscriptions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan_key   text NOT NULL REFERENCES plans(key),
  status     subscription_status NOT NULL DEFAULT 'trialing',

  trial_start          timestamptz,
  trial_end            timestamptz,
  started_at           timestamptz,
  current_period_start timestamptz,
  current_period_end   timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  cancelled_at         timestamptz,

  -- Provider identifiers only. No card number, no CVC, nothing that would make
  -- this database worth stealing for its payment data.
  provider                 text,
  provider_customer_id     text,
  provider_subscription_id text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One live subscription per company. History is kept by leaving cancelled and
-- expired rows in place, so the partial index only constrains the current one.
CREATE UNIQUE INDEX subscriptions_company_live_key ON subscriptions (company_id)
  WHERE status IN ('trialing', 'active', 'past_due');
CREATE INDEX subscriptions_status_idx ON subscriptions (status);
-- The trial sweeper reads this: everything still marked trialing that has run out.
CREATE INDEX subscriptions_trial_end_idx ON subscriptions (trial_end)
  WHERE status = 'trialing';
CREATE INDEX subscriptions_provider_idx ON subscriptions (provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;

CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------ billing events -------------------------------
--
-- Every webhook the provider sends, recorded before it is acted on.
--
-- Providers retry, and they retry the same event. Without this table a repeated
-- "invoice paid" extends a subscription twice; with it the second delivery
-- finds its own id already present and stops.
CREATE TABLE billing_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider     text NOT NULL,
  event_id     text NOT NULL,
  event_type   text NOT NULL,
  company_id   uuid REFERENCES companies(id) ON DELETE SET NULL,
  payload      jsonb,
  processed_at timestamptz,
  error        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX billing_events_provider_event_key ON billing_events (provider, event_id);
CREATE INDEX billing_events_unprocessed_idx ON billing_events (created_at)
  WHERE processed_at IS NULL;

-- ----------------------------- saved candidates ------------------------------
--
-- Saved by the company, not by the individual recruiter: a colleague picking up
-- the same search should see what the team has already shortlisted.
CREATE TABLE saved_candidates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  saved_by     uuid REFERENCES users(id) ON DELETE SET NULL,
  note         text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX saved_candidates_key ON saved_candidates (company_id, candidate_id);
CREATE INDEX saved_candidates_company_idx ON saved_candidates (company_id, created_at DESC);

-- --------------------------- recruitment requests ----------------------------

CREATE TYPE request_type AS ENUM ('contact', 'interview');
CREATE TYPE request_status AS ENUM (
  'pending', 'accepted', 'declined', 'cancelled', 'completed', 'expired'
);

CREATE TABLE recruitment_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  recruiter_id uuid REFERENCES users(id) ON DELETE SET NULL,
  type         request_type NOT NULL,
  status       request_status NOT NULL DEFAULT 'pending',
  -- What the recruiter wrote, and what the candidate wrote back. Both are shown
  -- to the other party, so both are stored; neither is shown to anyone else.
  message      text,
  response     text,
  role_context text,
  responded_at timestamptz,
  resolved_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- One open request of each type per company per candidate. A recruiter who
-- clicks twice, or two colleagues who both find the same person, must not
-- produce two notifications for the same ask.
CREATE UNIQUE INDEX recruitment_requests_open_key
  ON recruitment_requests (company_id, candidate_id, type)
  WHERE status = 'pending';
CREATE INDEX recruitment_requests_candidate_idx
  ON recruitment_requests (candidate_id, created_at DESC);
CREATE INDEX recruitment_requests_company_idx
  ON recruitment_requests (company_id, status, created_at DESC);

CREATE TRIGGER recruitment_requests_updated_at BEFORE UPDATE ON recruitment_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------ pipeline stages ------------------------------
--
-- Stages live in a table rather than an enum so a company process that gains a
-- step does not need a migration and a release. The API returns them, and the
-- portal renders whatever it is given.
CREATE TABLE pipeline_stages (
  key        text PRIMARY KEY,
  label_en   text NOT NULL,
  label_de   text NOT NULL,
  label_fr   text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_terminal boolean NOT NULL DEFAULT false,
  enabled    boolean NOT NULL DEFAULT true
);

CREATE TABLE pipeline_entries (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_id   uuid REFERENCES recruitment_requests(id) ON DELETE SET NULL,
  stage        text NOT NULL REFERENCES pipeline_stages(key),
  note         text,
  updated_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX pipeline_entries_key ON pipeline_entries (company_id, candidate_id);
CREATE INDEX pipeline_entries_company_idx ON pipeline_entries (company_id, stage);

CREATE TRIGGER pipeline_entries_updated_at BEFORE UPDATE ON pipeline_entries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Every stage change, kept. "When did this candidate reach interview" is a
-- question the current stage cannot answer.
CREATE TABLE pipeline_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id    uuid NOT NULL REFERENCES pipeline_entries(id) ON DELETE CASCADE,
  from_stage  text,
  to_stage    text NOT NULL,
  actor_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX pipeline_events_entry_idx ON pipeline_events (entry_id, created_at DESC);

-- ------------------------- candidate search indexes --------------------------
--
-- The columns the recruiter search actually filters on. Added here rather than
-- guessed at later, because the search is the one query in this milestone that
-- will be run thousands of times against a growing table.

CREATE INDEX IF NOT EXISTS profile_skills_name_idx
  ON profile_skills (lower(name) text_pattern_ops);
CREATE INDEX IF NOT EXISTS profile_languages_lang_level_idx
  ON profile_languages (lower(language), level);
CREATE INDEX IF NOT EXISTS candidate_profiles_experience_idx
  ON candidate_profiles (total_experience_months);
CREATE INDEX IF NOT EXISTS candidate_profiles_country_idx
  ON candidate_profiles (lower(country));
CREATE INDEX IF NOT EXISTS readiness_assessments_score_idx
  ON readiness_assessments (score DESC);

-- ---------------------------------- seed -------------------------------------
--
-- Idempotent: the production database may already have these, and a seed that
-- overwrites a price an admin has changed is worse than no seed at all. Prices
-- are only set on insert; ON CONFLICT deliberately does not touch them.

INSERT INTO plans (key, name, description, price_cents, currency, interval, trial_days, enabled, highlighted, sort_order)
VALUES
  ('trial', 'Free trial', 'Anonymised candidate discovery for seven days.', 0, 'EUR', NULL, 7, true, false, 1),
  ('professional', 'Professional', 'Full search, richer profiles subject to candidate consent, and the interview workflow.', 5000, 'EUR', 'month', 0, true, true, 2),
  -- Premium is sold on request. NULL price is the honest state, and the portal
  -- renders it as "on request" rather than inventing a figure.
  ('premium', 'Premium', 'Managed recruitment support, shortlist preparation and interview coordination.', NULL, 'EUR', 'month', 0, true, false, 3)
ON CONFLICT (key) DO NOTHING;

INSERT INTO plan_features (plan_key, feature, enabled) VALUES
  -- Trial: discovery and the ability to ask. Everything that would reveal more
  -- of a person than the anonymised card is off.
  ('trial', 'candidate_search', true),
  ('trial', 'anonymised_profiles', true),
  ('trial', 'saved_candidates', true),
  ('trial', 'contact_requests', true),
  ('trial', 'interview_requests', false),
  ('trial', 'advanced_filters', false),
  ('trial', 'enhanced_profiles', false),
  ('trial', 'candidate_matching', false),
  ('trial', 'recruitment_pipeline', false),
  ('trial', 'team_management', false),
  ('trial', 'premium_support', false),

  ('professional', 'candidate_search', true),
  ('professional', 'anonymised_profiles', true),
  ('professional', 'saved_candidates', true),
  ('professional', 'contact_requests', true),
  ('professional', 'interview_requests', true),
  ('professional', 'advanced_filters', true),
  -- Note: this entitles the plan. It does not by itself reveal anything — the
  -- candidate's own consent is checked separately and independently.
  ('professional', 'enhanced_profiles', true),
  ('professional', 'candidate_matching', true),
  ('professional', 'recruitment_pipeline', true),
  ('professional', 'team_management', true),
  ('professional', 'premium_support', false),

  ('premium', 'candidate_search', true),
  ('premium', 'anonymised_profiles', true),
  ('premium', 'saved_candidates', true),
  ('premium', 'contact_requests', true),
  ('premium', 'interview_requests', true),
  ('premium', 'advanced_filters', true),
  ('premium', 'enhanced_profiles', true),
  ('premium', 'candidate_matching', true),
  ('premium', 'recruitment_pipeline', true),
  ('premium', 'team_management', true),
  ('premium', 'premium_support', true)
ON CONFLICT (plan_key, feature) DO NOTHING;

INSERT INTO pipeline_stages (key, label_en, label_de, label_fr, sort_order, is_terminal) VALUES
  ('contact_requested',   'Contact requested',   'Kontakt angefragt',    'Contact demandé',      1, false),
  ('candidate_responded', 'Candidate responded', 'Kandidat geantwortet', 'Candidat a répondu',   2, false),
  ('interview_requested', 'Interview requested', 'Interview angefragt',  'Entretien demandé',    3, false),
  ('interview',           'Interview',           'Interview',            'Entretien',            4, false),
  ('feedback',            'Feedback',            'Feedback',             'Retour',               5, false),
  ('selected',            'Selected',            'Ausgewählt',           'Sélectionné',          6, false),
  ('offer',               'Offer',               'Angebot',              'Offre',                7, false),
  ('contract',            'Contract',            'Vertrag',              'Contrat',              8, false),
  ('relocation',          'Relocation',          'Umzug',                'Relocalisation',       9, false),
  ('completed',           'Completed',           'Abgeschlossen',        'Terminé',             10, true),
  ('closed',              'Closed',              'Beendet',              'Clôturé',             11, true)
ON CONFLICT (key) DO NOTHING;
