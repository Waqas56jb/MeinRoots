-- =============================================================================
-- Milestone 2 — the recruiter side of the marketplace.
--
-- Milestone 1 built one half: a candidate uploads a CV and gets a structured,
-- assessed profile. This is the other half — companies that can find those
-- candidates without being handed their identity.
--
-- Two decisions run through the whole file:
--
--   1. A candidate's identity is never a column a recruiter query can reach.
--      Discovery works off a stable public reference, and the join back to the
--      person is only made by code that has already checked entitlement and
--      consent. Privacy that depends on remembering to exclude a column is
--      privacy that fails the first time someone writes SELECT *.
--
--   2. Money and entitlement are configuration, not code. Plans, prices and
--      features live in tables so a price change is an UPDATE rather than a
--      release, and so the console can show what is actually charged.
-- =============================================================================

-- ------------------------------- roles --------------------------------------

-- A recruiter is a user like any other as far as sessions go; the difference is
-- what they may reach. company_admin is the seat that can manage the team and
-- the subscription — one company always has exactly one route to those.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'recruiter';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'company_admin';

-- The six things a recruiter confirms at registration. Separate values rather
-- than one 'recruiter_terms' because they are separate statements: an
-- agreement, an acknowledgement, a representation about who you are, an
-- undertaking about what you will do, and two confirmations of understanding.
ALTER TYPE consent_type ADD VALUE IF NOT EXISTS 'recruiter_terms';
ALTER TYPE consent_type ADD VALUE IF NOT EXISTS 'recruiter_privacy';
ALTER TYPE consent_type ADD VALUE IF NOT EXISTS 'legitimate_company';
ALTER TYPE consent_type ADD VALUE IF NOT EXISTS 'legitimate_use';
ALTER TYPE consent_type ADD VALUE IF NOT EXISTS 'access_understood';
ALTER TYPE consent_type ADD VALUE IF NOT EXISTS 'no_guarantee';
