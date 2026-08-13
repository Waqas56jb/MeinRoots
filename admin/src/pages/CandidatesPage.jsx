import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Layout from '../components/Layout.jsx'
import Icon from '../components/Icon.jsx'
import { Confidence, CvBadge, Empty, ErrorNote, Pager, ReviewBadge, Score, Skeleton } from '../components/ui.jsx'
import { useI18n } from '../context/I18nContext.jsx'
import { adminApi } from '../lib/api.js'
import { formatDate, formatExperience } from '../lib/format.js'

const LIMIT = 25
const STATUSES = ['pending', 'auto_cleared', 'flagged', 'approved', 'rejected']
const GOALS = ['germany', 'remote', 'freelance', 'ausbildung']
const SORTS = ['recent', 'readiness', 'completeness', 'confidence']

export default function CandidatesPage() {
  const { t, tError, locale } = useI18n()
  // Filters live in the URL so a filtered queue can be bookmarked and shared —
  // "the seven flagged healthcare profiles" is a link, not a set of clicks.
  const [params, setParams] = useSearchParams()

  const [rows, setRows] = useState(null)
  const [meta, setMeta] = useState({ total: 0 })
  const [domains, setDomains] = useState([])
  const [error, setError] = useState('')
  const [search, setSearch] = useState(params.get('q') ?? '')

  const filters = {
    q: params.get('q') ?? '',
    status: params.get('status') ?? '',
    goal: params.get('goal') ?? '',
    domain: params.get('domain') ?? '',
    sort: params.get('sort') ?? 'recent',
    flagged: params.get('flagged') === '1',
    offset: Number(params.get('offset') ?? 0),
  }

  const activeCount = [filters.status, filters.goal, filters.domain, filters.flagged && '1', filters.q].filter(
    Boolean,
  ).length

  const update = (patch, resetOffset = true) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(patch)) {
      if (value === '' || value === false || value === null || value === undefined) next.delete(key)
      else next.set(key, value === true ? '1' : String(value))
    }
    if (resetOffset) next.delete('offset')
    setParams(next, { replace: true })
  }

  useEffect(() => {
    adminApi.stats().then((s) => setDomains(s.byDomain ?? [])).catch(() => {})
  }, [])

  // Typing shouldn't fire a request per keystroke; 350ms is long enough to be
  // one query per word and short enough not to feel laggy.
  useEffect(() => {
    const id = setTimeout(() => {
      if (search !== filters.q) update({ q: search })
    }, 350)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const load = useCallback(async () => {
    setRows(null)
    setError('')
    try {
      const response = await adminApi.candidates({
        q: filters.q,
        status: filters.status,
        goal: filters.goal,
        domain: filters.domain,
        sort: filters.sort,
        flagged: filters.flagged || undefined,
        limit: LIMIT,
        offset: filters.offset,
      })
      setRows(response.data ?? [])
      setMeta(response.meta ?? { total: 0 })
    } catch (err) {
      setError(tError(err.code))
      setRows([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, tError])

  useEffect(() => {
    load()
  }, [load])

  return (
    <Layout
      title={t('candidates.title')}
      subtitle={t('candidates.subtitle')}
      actions={
        <button type="button" className="btn btn--ghost btn--sm" onClick={load}>
          <Icon name="refresh" size={16} /> <span className="hide-sm">{t('common.refresh')}</span>
        </button>
      }
    >
      <div className="filters">
        <div className="filters__search">
          <Icon name="search" size={17} />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('candidates.searchPlaceholder')}
            aria-label={t('common.search')}
            autoCapitalize="none"
            autoCorrect="off"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} aria-label={t('common.close')}>
              <Icon name="close" size={15} />
            </button>
          )}
        </div>

        <div className="filters__row">
          <select value={filters.status} onChange={(e) => update({ status: e.target.value })} aria-label={t('candidates.filters.status')}>
            <option value="">{t('candidates.filters.status')}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{t(`review.${s}`)}</option>
            ))}
          </select>

          <select value={filters.goal} onChange={(e) => update({ goal: e.target.value })} aria-label={t('candidates.filters.goal')}>
            <option value="">{t('candidates.filters.goal')}</option>
            {GOALS.map((g) => (
              <option key={g} value={g}>{t(`goals.${g}`)}</option>
            ))}
          </select>

          <select value={filters.domain} onChange={(e) => update({ domain: e.target.value })} aria-label={t('candidates.filters.domain')}>
            <option value="">{t('candidates.filters.domain')}</option>
            {domains.map((d) => (
              <option key={d.code} value={d.code}>{d.label_en} ({d.candidates})</option>
            ))}
          </select>

          <select value={filters.sort} onChange={(e) => update({ sort: e.target.value })} aria-label={t('candidates.filters.sort')}>
            {SORTS.map((s) => (
              <option key={s} value={s}>{t(`candidates.sort.${s}`)}</option>
            ))}
          </select>

          <button
            type="button"
            className={`toggle ${filters.flagged ? 'is-on' : ''}`}
            onClick={() => update({ flagged: !filters.flagged })}
            aria-pressed={filters.flagged}
          >
            <Icon name="warning" size={15} />
            {t('candidates.filters.needsReview')}
          </button>

          {activeCount > 0 && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => { setSearch(''); setParams(new URLSearchParams(), { replace: true }) }}
            >
              <Icon name="close" size={15} /> {t('candidates.filters.clear')}
            </button>
          )}
        </div>
      </div>

      <ErrorNote message={error} onRetry={load} />

      {rows === null ? (
        <Skeleton rows={6} />
      ) : rows.length === 0 ? (
        <Empty
          icon={activeCount ? 'search' : 'users'}
          title={activeCount ? t('candidates.emptyTitle') : t('candidates.noneTitle')}
          text={activeCount ? t('candidates.emptyText') : t('candidates.noneText')}
        />
      ) : (
        <>
          {/* Desktop: a dense table. Mobile: the same rows as cards — a table
              with seven columns on a 390px screen is unusable either way it is
              squeezed. */}
          <div className="tablewrap hide-md">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('candidates.table.candidate')}</th>
                  <th>{t('candidates.table.domain')}</th>
                  <th>{t('candidates.table.goals')}</th>
                  <th>{t('candidates.table.readiness')}</th>
                  <th>{t('candidates.table.confidence')}</th>
                  <th>{t('candidates.table.cv')}</th>
                  <th>{t('candidates.table.status')}</th>
                  <th aria-label={t('candidates.table.open')} />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.userId}>
                    <td>
                      <Link to={`/candidates/${row.userId}`} className="who">
                        <strong>{row.name}</strong>
                        <span>{row.email}</span>
                      </Link>
                    </td>
                    <td>
                      {row.domain ? (
                        <>
                          <span className="badge badge--brand">{row.domain}</span>
                          {row.specialisation && <div className="muted small">{row.specialisation}</div>}
                        </>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      <ul className="tags">
                        {(row.goals ?? []).map((g) => (
                          <li key={g}>{t(`goals.${g}`)}</li>
                        ))}
                      </ul>
                    </td>
                    <td><Score value={row.bestReadiness} /></td>
                    <td><Confidence value={row.extractionConfidence} /></td>
                    <td><CvBadge status={row.cvStatus} /></td>
                    <td>
                      <ReviewBadge status={row.reviewStatus} />
                      {row.openFlags > 0 && (
                        <span className="badge badge--warn"><Icon name="warning" size={12} />{row.openFlags}</span>
                      )}
                    </td>
                    <td className="table__go">
                      <Link to={`/candidates/${row.userId}`} className="btn btn--ghost btn--sm" aria-label={t('candidates.table.open')}>
                        <Icon name="chevronRight" size={16} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="cardlist show-md">
            {rows.map((row) => (
              <li key={row.userId}>
                <Link to={`/candidates/${row.userId}`} className="ccard">
                  <div className="ccard__head">
                    <div>
                      <strong>{row.name}</strong>
                      <span className="muted small">{row.email}</span>
                    </div>
                    <Score value={row.bestReadiness} />
                  </div>

                  <div className="ccard__badges">
                    <ReviewBadge status={row.reviewStatus} />
                    <CvBadge status={row.cvStatus} />
                    {row.openFlags > 0 && (
                      <span className="badge badge--warn"><Icon name="warning" size={12} />{row.openFlags}</span>
                    )}
                  </div>

                  <dl className="ccard__meta">
                    <div>
                      <dt>{t('candidates.table.domain')}</dt>
                      <dd>{row.domain ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>{t('candidates.table.confidence')}</dt>
                      <dd><Confidence value={row.extractionConfidence} /></dd>
                    </div>
                    <div>
                      <dt>{t('profile.experience')}</dt>
                      <dd>{formatExperience(row.totalExperienceMonths)}</dd>
                    </div>
                  </dl>

                  <ul className="tags">
                    {(row.goals ?? []).map((g) => (
                      <li key={g}>{t(`goals.${g}`)}</li>
                    ))}
                  </ul>

                  <span className="ccard__foot">
                    {t('candidates.registered', { date: formatDate(row.createdAt, locale) })}
                    <Icon name="chevronRight" size={16} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <Pager
            offset={filters.offset}
            limit={LIMIT}
            total={meta.total}
            onChange={(offset) => update({ offset: offset || '' }, false)}
          />
        </>
      )}
    </Layout>
  )
}
