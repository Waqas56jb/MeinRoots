import { api, qs } from '../lib/api.js'

/**
 * Every call this portal makes, in one place.
 *
 * This file is the contract with the Milestone 2 backend. Nothing else in the
 * portal calls fetch, so the complete list of what the server has to provide is
 * readable here rather than scattered across twenty components — which is the
 * point, because the backend does not exist yet and this is the specification
 * it will be built against.
 *
 * Two groups:
 *
 *   LIVE     — already served by the Milestone 1 API and working today.
 *   PENDING  — Milestone 2 routes. They return 404 until the backend prompt
 *              implements them, and the pages handle that state explicitly
 *              rather than pretending to have data.
 *
 * Marked in the comment above each call, so nobody has to guess which is which.
 */

/* ------------------------------ LIVE (M1) -------------------------------- */

export const authApi = {
  /** LIVE — the shared session endpoints. A recruiter is a user like any other. */
  login: (payload) => api.post('/api/auth/login', payload),
  logout: () => api.post('/api/auth/logout'),
  me: () => api.get('/api/auth/me'),
  requestReset: (email) => api.post('/api/auth/password/reset-request', { email }),
  resetPassword: (payload) => api.post('/api/auth/password/reset', payload),
  verifyEmail: (token) => api.post('/api/auth/email/verify', { token }),
  resendVerification: () => api.post('/api/auth/email/verify/resend'),
  changePassword: (payload) => api.post('/api/auth/password/change', payload),
  updateLocale: (locale) => api.patch('/api/auth/locale', { locale }),
}

/* ---------------------------- PENDING (M2) -------------------------------- */

export const recruiterApi = {
  /**
   * PENDING — POST /api/recruiter/register
   * body: { recruiter: { name, email, password, phone? },
   *         company:   { legalName, tradingName?, country, city?, website?,
   *                      registrationNumber?, vatId?, size?, industry? },
   *         consents:  { terms, privacy, legitimate_company, legitimate_use,
   *                      access_understood, no_guarantee },
   *         locale }
   * → 201 { user, company, subscription }
   */
  register: (payload) => api.post('/api/recruiter/register', payload),

  /**
   * PENDING — GET /api/recruiter/me
   * → { user, company: { id, legalName, verificationStatus, ... },
   *     subscription: { plan, status, trialEndsAt, renewsAt, ... },
   *     features: { [featureKey]: boolean } }
   *
   * `features` is the authoritative access map. The portal renders from it and
   * never decides for itself what a plan includes — a front end that computes
   * its own entitlements is a front end that can be argued with.
   */
  me: () => api.get('/api/recruiter/me'),
}

export const companyApi = {
  /** PENDING — GET /api/recruiter/company */
  get: () => api.get('/api/recruiter/company'),
  /** PENDING — PATCH /api/recruiter/company  body: partial company profile */
  update: (payload) => api.patch('/api/recruiter/company', payload),
}

export const teamApi = {
  /** PENDING — GET /api/recruiter/team → { members: [{ id, name, email, role, status, invitedAt, lastLoginAt }] } */
  list: () => api.get('/api/recruiter/team'),
  /** PENDING — POST /api/recruiter/team/invitations  body: { email, role } */
  invite: (payload) => api.post('/api/recruiter/team/invitations', payload),
  /** PENDING — DELETE /api/recruiter/team/:memberId */
  remove: (memberId) => api.del(`/api/recruiter/team/${memberId}`),
}

export const searchApi = {
  /**
   * PENDING — GET /api/recruiter/candidates
   * query: q, profession, skills (csv), germanLevel, minExperienceMonths,
   *        location, workAuthorisation, minReadiness, goal, sort, limit, offset
   * → { data: [CandidateCard], meta: { total } }
   *
   * CandidateCard is the anonymised shape. It must never contain name, email,
   * phone or anything else identifying — the server decides what a recruiter on
   * this plan, with this candidate's consent, is allowed to see. The portal
   * cannot un-hide what it was never sent, which is the only version of this
   * that actually protects anyone.
   *
   * CandidateCard: { id, reference, profession, specialisation,
   *                  experienceMonths, germanLevel, languages[], skills[],
   *                  location, workAuthorisation, readiness, goals[],
   *                  isSaved, requestState }
   */
  candidates: (params = {}) => api.get(`/api/recruiter/candidates${qs(params)}`),

  /**
   * PENDING — GET /api/recruiter/candidates/:id
   * → { candidate: CandidateCard & { summary?, experiences[], education[],
   *       certifications[], readinessDetail }, access: { level, contact } }
   *
   * `access.level` is one of: anonymous | restricted | granted.
   * `access.contact` is present only when the server has decided this recruiter
   * may see it. Absent means absent — not blurred, not hidden with CSS.
   */
  candidate: (id) => api.get(`/api/recruiter/candidates/${id}`),

  /** PENDING — GET /api/recruiter/filters → the option lists the backend supports */
  filters: () => api.get('/api/recruiter/filters'),
}

export const savedApi = {
  /** PENDING — GET /api/recruiter/saved → { data: [CandidateCard], meta } */
  list: (params = {}) => api.get(`/api/recruiter/saved${qs(params)}`),
  /** PENDING — POST /api/recruiter/candidates/:id/save */
  save: (candidateId) => api.post(`/api/recruiter/candidates/${candidateId}/save`),
  /** PENDING — DELETE /api/recruiter/candidates/:id/save */
  unsave: (candidateId) => api.del(`/api/recruiter/candidates/${candidateId}/save`),
}

export const requestApi = {
  /** PENDING — GET /api/recruiter/requests?type=contact|interview&status=… */
  list: (params = {}) => api.get(`/api/recruiter/requests${qs(params)}`),
  /** PENDING — GET /api/recruiter/requests/:id */
  get: (id) => api.get(`/api/recruiter/requests/${id}`),
  /**
   * PENDING — POST /api/recruiter/requests
   * body: { candidateId, type: 'contact' | 'interview', message?, context? }
   * → 201 { request }
   *
   * The server owns every rule here: whether the plan allows it, whether the
   * candidate consented to being contacted, whether one is already open.
   */
  create: (payload) => api.post('/api/recruiter/requests', payload),
  /** PENDING — DELETE /api/recruiter/requests/:id  (withdraw a pending request) */
  cancel: (id) => api.del(`/api/recruiter/requests/${id}`),
}

export const pipelineApi = {
  /**
   * PENDING — GET /api/recruiter/pipeline
   * → { stages: [{ key, label, count }], entries: [{ id, candidate, stage, ... }] }
   *
   * Stages come from the server rather than being hard-coded here, so a stage
   * added later appears without a front-end release.
   */
  list: (params = {}) => api.get(`/api/recruiter/pipeline${qs(params)}`),
}

export const billingApi = {
  /** PENDING — GET /api/recruiter/plans → { plans: [{ key, name, price, currency, interval, trialDays, features[] }] } */
  plans: () => api.get('/api/recruiter/plans'),
  /** PENDING — GET /api/recruiter/subscription */
  subscription: () => api.get('/api/recruiter/subscription'),
  /** PENDING — POST /api/recruiter/subscription/upgrade  body: { plan } */
  upgrade: (payload) => api.post('/api/recruiter/subscription/upgrade', payload),
  /** PENDING — POST /api/recruiter/subscription/cancel */
  cancel: () => api.post('/api/recruiter/subscription/cancel'),
  /** PENDING — GET /api/recruiter/invoices */
  invoices: () => api.get('/api/recruiter/invoices'),
}

export const notificationApi = {
  /** PENDING — GET /api/recruiter/notifications → { data: [...], meta: { unread } } */
  list: (params = {}) => api.get(`/api/recruiter/notifications${qs(params)}`),
  /** PENDING — POST /api/recruiter/notifications/read  body: { ids? } */
  markRead: (ids) => api.post('/api/recruiter/notifications/read', { ids }),
}
