import { one } from '../../db/pool.js'
import { forbidden } from '../../lib/errors.js'
import { entitlementsFor } from './entitlements.js'

/**
 * Resolves who is asking, which company they belong to, and what that company
 * may do — once per request, before any handler runs.
 *
 * Everything downstream reads `req.recruiter` and never re-derives the company
 * from anything the client sent. That is the whole defence against one company
 * reaching another's data: no route takes a company id as a parameter, because
 * there is only ever one company the caller could mean.
 */
export const requireRecruiter = async (req, _res, next) => {
  try {
    const role = req.user?.role
    if (role !== 'recruiter' && role !== 'company_admin') {
      // Deliberately the same answer a candidate or an admin would get. Whether
      // recruiter endpoints exist is not information worth confirming.
      throw forbidden('forbidden', 'Not allowed')
    }

    const membership = await one(
      `SELECT m.id, m.company_id, m.role, m.status,
              c.legal_name, c.trading_name, c.verification_status, c.deactivated_at
         FROM company_members m
         JOIN companies c ON c.id = m.company_id
        WHERE m.user_id = $1`,
      [req.user.id],
    )

    if (!membership) throw forbidden('no_company', 'This account is not attached to a company')
    if (membership.status !== 'active') throw forbidden('membership_inactive', 'This seat is not active')
    if (membership.deactivated_at) throw forbidden('company_inactive', 'This company account is closed')

    const entitlements = await entitlementsFor(membership.company_id)

    req.recruiter = {
      userId: req.user.id,
      companyId: membership.company_id,
      role: membership.role,
      isCompanyAdmin: membership.role === 'company_admin',
      company: membership,
      entitlements,
    }
    next()
  } catch (err) {
    next(err)
  }
}

/** Guards the seats that manage the team, the company record and the billing. */
export const requireCompanyAdmin = (req, _res, next) => {
  if (!req.recruiter?.isCompanyAdmin) {
    return next(forbidden('company_admin_required', 'Only a company administrator can do that'))
  }
  return next()
}

/**
 * Guards a route on a plan feature.
 *
 * The error names the feature so the portal can show the right upgrade prompt,
 * which is a deliberate disclosure: telling a paying customer which capability
 * they are missing is the point, and reveals nothing about anyone else.
 */
export const requireFeature = (feature) => (req, _res, next) => {
  if (req.recruiter?.entitlements?.features?.[feature] !== true) {
    return next(forbidden('feature_not_available', `Your plan does not include ${feature}`))
  }
  return next()
}
