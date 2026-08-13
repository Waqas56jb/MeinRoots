/**
 * Response helpers.
 *
 * Every success body is `{ data: ... }` and every failure is `{ error: {...} }`,
 * so the front-end client can branch on one thing instead of guessing per
 * endpoint.
 */
export const ok = (res, data, status = 200) => res.status(status).json({ data })

export const created = (res, data) => ok(res, data, 201)

export const noContent = (res) => res.status(204).end()

/** Paginated list envelope — `total` is what the UI needs for "x of y". */
export const page = (res, items, { total, limit, offset }) =>
  res.json({ data: items, meta: { total, limit, offset, hasMore: offset + items.length < total } })
