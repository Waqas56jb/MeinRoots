-- =============================================================================
-- MeinRoots — Milestone 1 schema
--
-- Candidate onboarding + AI qualification. Deliberately shaped so Milestone 2
-- (job aggregation, recruiter/candidate subscriptions, payments, messaging,
-- employer access) can be added as new tables that reference these, without
-- rewriting anything here.
--
-- Conventions
--   * uuid primary keys — ids are handed to the browser, sequential ints leak
--     how many candidates exist and invite enumeration
--   * timestamptz everywhere, never naive timestamps
--   * soft delete via deleted_at on user-owned data (GDPR erasure is a separate
--     hard-delete path, see 003)
--   * every AI-produced value carries a confidence and stays flagged until a
--     human reviews it
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS citext;

-- ------------------------------- enums --------------------------------------

CREATE TYPE user_role       AS ENUM ('candidate', 'admin', 'super_admin');
CREATE TYPE work_goal       AS ENUM ('germany', 'remote', 'freelance', 'ausbildung');
CREATE TYPE document_status AS ENUM ('uploaded', 'processing', 'analysed', 'failed');
CREATE TYPE job_status      AS ENUM ('queued', 'running', 'succeeded', 'failed', 'dead');
CREATE TYPE review_status   AS ENUM ('pending', 'auto_cleared', 'flagged', 'approved', 'rejected');
CREATE TYPE cefr_level      AS ENUM ('A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'native');
CREATE TYPE skill_category  AS ENUM ('technical', 'tool', 'domain', 'soft', 'language', 'other');
CREATE TYPE gap_importance  AS ENUM ('critical', 'important', 'nice_to_have');
CREATE TYPE readiness_band  AS ENUM ('not_ready', 'developing', 'nearly_ready', 'ready');
CREATE TYPE answer_type     AS ENUM ('text', 'long_text', 'single_select', 'multi_select', 'boolean', 'number', 'date');

-- --------------------------- updated_at trigger ------------------------------

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ================================ users ======================================

CREATE TABLE users (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name        text        NOT NULL CHECK (length(btrim(full_name)) > 0),
  -- citext so "Anna@x.de" and "anna@x.de" can never become two accounts
  email            citext      NOT NULL,
  password_hash    text        NOT NULL,
  role             user_role   NOT NULL DEFAULT 'candidate',
  locale           text        NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'de', 'fr')),
  goals            work_goal[] NOT NULL DEFAULT '{}',
  phone            text,
  country          text,
  -- the explicit GDPR tick at signup; null means we may not process the CV
  gdpr_consent_at  timestamptz,
  email_verified_at timestamptz,
  last_login_at    timestamptz,
  failed_logins    integer     NOT NULL DEFAULT 0,
  locked_until     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);

-- partial unique: a deleted account frees its address for re-registration
CREATE UNIQUE INDEX users_email_active_key ON users (email) WHERE deleted_at IS NULL;
CREATE INDEX users_role_idx    ON users (role) WHERE deleted_at IS NULL;
CREATE INDEX users_created_idx ON users (created_at DESC);

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Refresh tokens live in the database so "log out everywhere" and admin-forced
-- revocation are possible; the short-lived access JWT is never stored.
CREATE TABLE sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   text        NOT NULL UNIQUE,   -- sha256, never the token itself
  user_agent   text,
  ip           inet,
  expires_at   timestamptz NOT NULL,
  revoked_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions (user_id) WHERE revoked_at IS NULL;

CREATE TABLE password_resets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  text        NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX password_resets_user_idx ON password_resets (user_id);

-- ============================= cv documents ==================================

CREATE TABLE cv_documents (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  original_filename text            NOT NULL,
  -- path relative to STORAGE_DIR. The bytes on disk are never rewritten:
  -- "your original CV is never modified" is a product promise, so translations
  -- and structured data are stored as separate rows, never in this file.
  storage_path      text            NOT NULL,
  mime_type         text            NOT NULL,
  size_bytes        bigint          NOT NULL CHECK (size_bytes > 0),
  sha256            char(64)        NOT NULL,
  source_language   text,                          -- detected, e.g. 'en'
  language_confidence numeric(4,3),
  page_count        integer,
  extracted_text    text,                          -- plain text used for the AI pass
  status            document_status NOT NULL DEFAULT 'uploaded',
  error_message     text,
  is_primary        boolean         NOT NULL DEFAULT true,
  uploaded_at       timestamptz     NOT NULL DEFAULT now(),
  processed_at      timestamptz,
  deleted_at        timestamptz
);
CREATE INDEX cv_documents_user_idx   ON cv_documents (user_id, uploaded_at DESC);
CREATE INDEX cv_documents_status_idx ON cv_documents (status);
-- one current CV per candidate; older uploads stay for audit with is_primary=false
CREATE UNIQUE INDEX cv_documents_primary_key ON cv_documents (user_id)
  WHERE is_primary AND deleted_at IS NULL;

-- Translated / regenerated CV renderings. The source-language row mirrors the
-- upload so the three languages can be listed uniformly.
CREATE TABLE cv_versions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  uuid        NOT NULL REFERENCES cv_documents(id) ON DELETE CASCADE,
  language     text        NOT NULL CHECK (language IN ('en', 'de', 'fr')),
  content      text        NOT NULL,          -- markdown
  is_source    boolean     NOT NULL DEFAULT false,
  model        text,
  reviewed_at  timestamptz,                   -- AI output stays labelled until this is set
  reviewed_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, language)
);

-- ============================ candidate profile ==============================

CREATE TABLE candidate_profiles (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_id            uuid REFERENCES cv_documents(id) ON DELETE SET NULL,
  headline               text,
  summary                text,
  -- not "current_role": that is a reserved word in Postgres and would need
  -- quoting at every single use site
  current_title          text,
  current_employer       text,
  total_experience_months integer CHECK (total_experience_months >= 0),
  country                text,
  city                   text,
  willing_to_relocate    boolean,
  notice_period_weeks    integer,
  -- mean confidence of the extraction; drives the admin "needs a human" filter
  extraction_confidence  numeric(4,3),
  review_status          review_status NOT NULL DEFAULT 'pending',
  completeness           integer NOT NULL DEFAULT 0 CHECK (completeness BETWEEN 0 AND 100),
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX candidate_profiles_review_idx ON candidate_profiles (review_status);

CREATE TRIGGER candidate_profiles_updated_at BEFORE UPDATE ON candidate_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE profile_experiences (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  uuid    NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  company     text,
  role        text    NOT NULL,
  employment_type text,
  location    text,
  country     text,
  start_date  date,
  end_date    date,
  is_current  boolean NOT NULL DEFAULT false,
  description text,
  skills      text[]  NOT NULL DEFAULT '{}',
  confidence  numeric(4,3),
  sort_order  integer NOT NULL DEFAULT 0,
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);
CREATE INDEX profile_experiences_profile_idx ON profile_experiences (profile_id, sort_order);

CREATE TABLE profile_education (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  uuid NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  institution text,
  degree      text,
  field       text,
  country     text,
  start_year  integer,
  end_year    integer,
  -- German recognition of a foreign degree is its own workflow (anabin); M1 only
  -- records whether the AI believed it is likely recognisable
  likely_recognised_in_de boolean,
  confidence  numeric(4,3),
  sort_order  integer NOT NULL DEFAULT 0
);
CREATE INDEX profile_education_profile_idx ON profile_education (profile_id, sort_order);

CREATE TABLE profile_certifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  uuid NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  name        text NOT NULL,
  issuer      text,
  issued_on   date,
  expires_on  date,
  credential_id text,
  confidence  numeric(4,3),
  sort_order  integer NOT NULL DEFAULT 0
);
CREATE INDEX profile_certifications_profile_idx ON profile_certifications (profile_id);

CREATE TABLE profile_skills (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  uuid NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  name        text NOT NULL,
  -- normalised lowercase form, so "Node.js" and "node.js" match when we start
  -- matching against job requirements in Milestone 2
  name_normalised text NOT NULL,
  category    skill_category NOT NULL DEFAULT 'technical',
  years       numeric(4,1),
  -- where in the CV this was actually evidenced; an unevidenced skill is a claim
  evidence    text,
  is_evidenced boolean NOT NULL DEFAULT false,
  confidence  numeric(4,3),
  UNIQUE (profile_id, name_normalised)
);
CREATE INDEX profile_skills_name_idx ON profile_skills (name_normalised);

CREATE TABLE profile_languages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  uuid NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  language    text NOT NULL,
  level       cefr_level,
  is_self_reported boolean NOT NULL DEFAULT true,
  certificate text,
  confidence  numeric(4,3),
  UNIQUE (profile_id, language)
);

-- Professional domain + specialisation, kept as history so a re-run can be
-- compared against what the admin previously saw.
CREATE TABLE profile_classifications (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id     uuid NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  domain         text NOT NULL,          -- 'it', 'health', 'engineering', ...
  domain_label   text,
  specialisation text,
  seniority      text,                   -- 'junior' | 'mid' | 'senior' | 'lead'
  rationale      text,
  confidence     numeric(4,3),
  model          text,
  is_current     boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX profile_classifications_current_key
  ON profile_classifications (profile_id) WHERE is_current;

-- =========================== readiness & gaps ================================

CREATE TABLE readiness_assessments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  uuid      NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  goal        work_goal NOT NULL,
  score       integer   NOT NULL CHECK (score BETWEEN 0 AND 100),
  band        readiness_band NOT NULL,
  summary     text,
  -- the explainable part: [{key,label,weight,score,status,detail}, ...].
  -- The SRS asks for an explainable status, not a black-box number, so the
  -- factors are stored with the score and rendered verbatim to the candidate.
  factors     jsonb     NOT NULL DEFAULT '[]'::jsonb,
  model       text,
  is_current  boolean   NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX readiness_current_key
  ON readiness_assessments (profile_id, goal) WHERE is_current;

CREATE TABLE skill_gaps (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES readiness_assessments(id) ON DELETE CASCADE,
  skill         text NOT NULL,
  importance    gap_importance NOT NULL DEFAULT 'important',
  current_level text,
  target_level  text,
  why           text,
  how_to_close  text,
  est_weeks     integer,
  resource_hint text,
  sort_order    integer NOT NULL DEFAULT 0
);
CREATE INDEX skill_gaps_assessment_idx ON skill_gaps (assessment_id, sort_order);

-- ============================ questionnaire ==================================
-- Only asks what the CV could not already establish, which is why the questions
-- are generated per candidate rather than being a fixed form.

CREATE TABLE questionnaires (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   uuid NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  generated_by text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX questionnaires_profile_idx ON questionnaires (profile_id);

CREATE TABLE questionnaire_questions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  questionnaire_id uuid NOT NULL REFERENCES questionnaires(id) ON DELETE CASCADE,
  key              text NOT NULL,
  question         text NOT NULL,
  help_text        text,
  input_type       answer_type NOT NULL DEFAULT 'text',
  options          jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_required      boolean NOT NULL DEFAULT true,
  -- why this was asked, shown to the candidate so the form never feels arbitrary
  reason           text,
  sort_order       integer NOT NULL DEFAULT 0,
  UNIQUE (questionnaire_id, key)
);
CREATE INDEX questionnaire_questions_q_idx ON questionnaire_questions (questionnaire_id, sort_order);

CREATE TABLE questionnaire_answers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id  uuid UNIQUE NOT NULL REFERENCES questionnaire_questions(id) ON DELETE CASCADE,
  value        jsonb NOT NULL,
  answered_at  timestamptz NOT NULL DEFAULT now()
);

-- ======================= admin review & exceptions ===========================

-- Machine-raised exceptions: the admin only opens a profile that has one.
CREATE TABLE review_flags (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  uuid NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  code        text NOT NULL,        -- 'low_confidence', 'no_experience_dates', ...
  severity    text NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  detail      text,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX review_flags_open_idx ON review_flags (profile_id) WHERE resolved_at IS NULL;

CREATE TABLE admin_reviews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  uuid NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  reviewer_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status      review_status NOT NULL,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_reviews_profile_idx ON admin_reviews (profile_id, created_at DESC);

-- ============================== job queue ====================================
-- Postgres-backed on purpose: the box runs Postgres already, and Milestone 1
-- has no throughput that would justify operating Redis as well.

CREATE TABLE jobs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type         text       NOT NULL,
  payload      jsonb      NOT NULL DEFAULT '{}'::jsonb,
  status       job_status NOT NULL DEFAULT 'queued',
  priority     integer    NOT NULL DEFAULT 0,
  attempts     integer    NOT NULL DEFAULT 0,
  max_attempts integer    NOT NULL DEFAULT 3,
  run_after    timestamptz NOT NULL DEFAULT now(),
  locked_at    timestamptz,
  locked_by    text,
  last_error   text,
  progress     jsonb      NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  started_at   timestamptz,
  finished_at  timestamptz
);
-- the exact shape the worker's claim query needs
CREATE INDEX jobs_claim_idx ON jobs (status, priority DESC, run_after)
  WHERE status = 'queued';
CREATE INDEX jobs_payload_document_idx ON jobs ((payload ->> 'documentId'));

-- Per-call AI accounting: token spend is a real cost centre and the admin needs
-- it visible from day one.
CREATE TABLE ai_calls (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id            uuid REFERENCES jobs(id) ON DELETE SET NULL,
  user_id           uuid REFERENCES users(id) ON DELETE SET NULL,
  purpose           text NOT NULL,
  model             text NOT NULL,
  prompt_tokens     integer,
  completion_tokens integer,
  duration_ms       integer,
  ok                boolean NOT NULL DEFAULT true,
  error             text,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_calls_created_idx ON ai_calls (created_at DESC);

-- =============================== audit log ===================================

CREATE TABLE audit_log (
  id          bigserial PRIMARY KEY,
  actor_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_role  user_role,
  action      text NOT NULL,          -- 'auth.login', 'cv.upload', 'admin.approve'
  entity_type text,
  entity_id   text,
  ip          inet,
  user_agent  text,
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_created_idx ON audit_log (created_at DESC);
CREATE INDEX audit_log_actor_idx   ON audit_log (actor_id, created_at DESC);
CREATE INDEX audit_log_action_idx  ON audit_log (action, created_at DESC);
