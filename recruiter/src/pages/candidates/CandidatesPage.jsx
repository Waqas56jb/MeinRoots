import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Layout from '../../components/Layout.jsx'
import Icon from '../../components/Icon.jsx'
import CandidateCard from '../../components/CandidateCard.jsx'
import RequestSheet from '../../components/RequestSheet.jsx'
import {
  EmptyState, ErrorState, FeatureGate, Pager, PendingState, Skeleton, UpgradePrompt,
} from '../../components/ui.jsx'
import { useDebounced, useResource } from '../../hooks/useResource.js'
import { savedApi, searchApi } from '../../services/index.js'
import { useI18n } from '../../context/I18nContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'

const LIMIT = 12

/** CEFR, in the order the levels actually run. */
const GERMAN_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'native']
const EXPERIENCE = [
  { key: 'any', months: '' },
  { key: 'y1', months: 12 },
  { key: 'y3', months: 36 },
  { key: 'y5', months: 60 },
  { key: 'y10', months: 120 },
]
const SORTS = ['relevance', 'readiness', 'experience', 'recent']

/**
 * Candidate discovery — the screen a recruiter spends their day in.
 *
 * Filters live in the URL so a search can be bookmarked and sent to a
 * colleague: "the B2 nurses in Berlin who are ready" is a link, not a set of
 * clicks to describe over a call.
 *
 * Three layouts rather than one that shrinks. A filter rail beside results on a
 * desktop, a collapsible panel on a tablet, and a full sheet behind a button on
 * a phone — because a sidebar squeezed onto 390px leaves no room for the thing
 * it is filtering.
 */
export default function CandidatesPage() {
  const { t } = useI18n()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [requestFor, setRequestFor] = useState(null)
  const [savingId, setSavingId] = useState(null)

  const [term, setTerm] = useState(params.get('q') ?? '')
  const debouncedTerm = useDebounced(term, 300)

  const filters = {
    q: params.get('q') ?? '',
    profession: params.get('profession') ?? '',
    germanLevel: params.get('germanLevel') ?? '',
    minExperienceMonths: params.get('minExperienceMonths') ?? '',
    location: params.get('location') ?? '',
    workAuthorisation: params.get('workAuthorisation') ?? '',
    minReadiness: params.get('minReadiness') ?? '',
    sort: params.get('sort') ?? 'relevance',
    offset: Number(params.get('offset') ?? 0),
  }

  const update = (patch, resetOffset = true) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(patch)) {
      if (value === '' || value === null || value === undefined || value === false) next.delete(key)
      else next.set(key, String(value))
    }
    if (resetOffset) next.delete('offset')
    setParams(next, { replace: true })
  }

  useEffect(() => {
    if (debouncedTerm !== filters.q) update({ q: debouncedTerm })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedTerm])

  // The chips can clear the search, so the input follows the URL back.
  useEffect(() => {
    setTerm(params.get('q') ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.get('q')])

  const results = useResource(
    () => searchApi.candidates({ ...filters, limit: LIMIT }),
    [params.toString()],
  )

  const rows = results.data?.data ?? []
  const total = results.data?.meta?.total ?? 0

  const active = [
    filters.q && { key: 'q', label: t('candidates.filters.searchChip', { q: filters.q }), clear: { q: '' } },
    filters.profession && { key: 'profession', label: filters.profession, clear: { profession: '' } },
    filters.germanLevel && {
      key: 'germanLevel',
      label: t('candidates.filters.germanChip', { level: filters.germanLevel }),
      clear: { germanLevel: '' },
    },
    filters.minExperienceMonths && {
      key: 'exp',
      label: t('candidates.filters.expChip', { years: Math.round(filters.minExperienceMonths / 12) }),
      clear: { minExperienceMonths: '' },
    },
    filters.location && { key: 'location', label: filters.location, clear: { location: '' } },
    filters.workAuthorisation && {
      key: 'auth',
      label: t(`candidates.auth.${filters.workAuthorisation}`),
      clear: { workAuthorisation: '' },
    },
    filters.minReadiness && {
      key: 'readiness',
      label: t('candidates.filters.readinessChip', { value: filters.minReadiness }),
      clear: { minReadiness: '' },
    },
  ].filter(Boolean)

  const clearAll = () => {
    setTerm('')
    setParams(new URLSearchParams(), { replace: true })
  }

  const toggleSave = async (candidate) => {
    setSavingId(candidate.id)
    try {
      if (candidate.isSaved) await savedApi.unsave(candidate.id)
      else await savedApi.save(candidate.id)
      // Reflect it locally rather than refetching the whole page for one flag.
      results.setData((current) =>
        current
          ? {
              ...current,
              data: current.data.map((c) => (c.id === candidate.id ? { ...c, isSaved: !c.isSaved } : c)),
            }
          : current,
      )
      toast.success(t(candidate.isSaved ? 'candidates.unsaved' : 'candidates.saved'))
    } catch {
      toast.error(t('candidates.saveFailed'))
    } finally {
      setSavingId(null)
    }
  }

  const filterPanel = (
    <div className="filters">
      <div className="filters__group">
        <label className="filters__label" htmlFor="f-profession">{t('candidates.filters.profession')}</label>
        <input
          id="f-profession"
          type="text"
          value={filters.profession}
          onChange={(e) => update({ profession: e.target.value })}
          placeholder={t('candidates.filters.professionPlaceholder')}
        />
      </div>

      <div className="filters__group">
        <span className="filters__label">{t('candidates.filters.german')}</span>
        <div className="filters__chips">
          {GERMAN_LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              className={filters.germanLevel === level ? 'is-on' : ''}
              aria-pressed={filters.germanLevel === level}
              onClick={() => update({ germanLevel: filters.germanLevel === level ? '' : level })}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      <div className="filters__group">
        <label className="filters__label" htmlFor="f-exp">{t('candidates.filters.experience')}</label>
        <select
          id="f-exp"
          value={filters.minExperienceMonths}
          onChange={(e) => update({ minExperienceMonths: e.target.value })}
        >
          {EXPERIENCE.map((e) => (
            <option key={e.key} value={e.months}>{t(`candidates.filters.exp.${e.key}`)}</option>
          ))}
        </select>
      </div>

      <div className="filters__group">
        <label className="filters__label" htmlFor="f-location">{t('candidates.filters.location')}</label>
        <input
          id="f-location"
          type="text"
          value={filters.location}
          onChange={(e) => update({ location: e.target.value })}
          placeholder={t('candidates.filters.locationPlaceholder')}
        />
      </div>

      {/*
        Advanced filtering is a paid capability. The gate shows what unlocks it
        rather than hiding the controls — a filter that silently is not there
        teaches nothing, and one that is visible but dead is worse.
      */}
      <FeatureGate feature="advanced_filters" fallback={<UpgradePrompt feature="advanced_filters" compact />}>
        <div className="filters__group">
          <label className="filters__label" htmlFor="f-auth">{t('candidates.filters.workAuth')}</label>
          <select
            id="f-auth"
            value={filters.workAuthorisation}
            onChange={(e) => update({ workAuthorisation: e.target.value })}
          >
            <option value="">{t('common.any')}</option>
            {['eu_citizen', 'permit_holder', 'visa_required', 'unknown'].map((a) => (
              <option key={a} value={a}>{t(`candidates.auth.${a}`)}</option>
            ))}
          </select>
        </div>

        <div className="filters__group">
          <label className="filters__label" htmlFor="f-readiness">
            {t('candidates.filters.readiness')}
            {filters.minReadiness && <em className="num"> {filters.minReadiness}+</em>}
          </label>
          <input
            id="f-readiness"
            type="range"
            min="0"
            max="100"
            step="10"
            value={filters.minReadiness || 0}
            onChange={(e) => update({ minReadiness: e.target.value === '0' ? '' : e.target.value })}
          />
        </div>
      </FeatureGate>

      {active.length > 0 && (
        <button type="button" className="btn btn--ghost btn--block btn--sm" onClick={clearAll}>
          <Icon name="close" size={15} /> {t('candidates.filters.clear')}
        </button>
      )}
    </div>
  )

  return (
    <Layout
      title={t('candidates.title')}
      subtitle={t('candidates.subtitle')}
      meta={
        !results.loading && !results.pending && total > 0 ? (
          <span className="topbar__count num">{t('candidates.count', { count: total })}</span>
        ) : null
      }
    >
      <div className="searchbar">
        <div className="searchbar__input">
          <Icon name="search" size={18} />
          <input
            type="search"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={t('candidates.searchPlaceholder')}
            aria-label={t('candidates.searchLabel')}
            autoCapitalize="none"
            autoCorrect="off"
          />
          {term && (
            <button type="button" onClick={() => setTerm('')} aria-label={t('candidates.filters.clearSearch')}>
              <Icon name="close" size={16} />
            </button>
          )}
        </div>

        <button
          type="button"
          className={`searchbar__filters ${active.length ? 'has-active' : ''}`}
          onClick={() => setFiltersOpen((v) => !v)}
          aria-expanded={filtersOpen}
        >
          <Icon name="sliders" size={17} />
          {t('candidates.filters.title')}
          {active.length > 0 && <em className="num">{active.length}</em>}
        </button>

        <select
          className="searchbar__sort"
          value={filters.sort}
          onChange={(e) => update({ sort: e.target.value })}
          aria-label={t('candidates.filters.sort')}
        >
          {SORTS.map((s) => (
            <option key={s} value={s}>{t(`candidates.sort.${s}`)}</option>
          ))}
        </select>
      </div>

      {active.length > 0 && (
        <div className="chips">
          {active.map((chip) => (
            <button
              key={chip.key}
              type="button"
              className="chip"
              onClick={() => update(chip.clear)}
              aria-label={t('candidates.filters.remove', { name: chip.label })}
            >
              {chip.label}
              <Icon name="close" size={13} />
            </button>
          ))}
        </div>
      )}

      <div className={`searchlayout ${filtersOpen ? 'is-open' : ''}`}>
        <aside className="searchlayout__rail" aria-label={t('candidates.filters.title')}>
          {filterPanel}
        </aside>

        <div className="searchlayout__results">
          {results.loading ? (
            <div className="cardgrid"><Skeleton variant="cards" rows={6} /></div>
          ) : results.pending ? (
            <PendingState
              endpoint="GET /api/recruiter/candidates"
              title={t('candidates.pendingTitle')}
              text={t('candidates.pendingText')}
            />
          ) : results.error ? (
            <ErrorState message={t('candidates.loadError')} onRetry={results.reload} />
          ) : !rows.length ? (
            <EmptyState
              icon="search"
              title={active.length ? t('candidates.noResults') : t('candidates.noneYet')}
              text={active.length ? t('candidates.noResultsText') : t('candidates.noneYetText')}
              action={
                active.length ? (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={clearAll}>
                    {t('candidates.filters.clear')}
                  </button>
                ) : null
              }
            />
          ) : (
            <>
              <div className="cardgrid">
                {rows.map((c) => (
                  <CandidateCard
                    key={c.id}
                    candidate={c}
                    onSave={toggleSave}
                    onRequest={setRequestFor}
                    saving={savingId === c.id}
                  />
                ))}
              </div>
              <Pager
                offset={filters.offset}
                limit={LIMIT}
                total={total}
                onChange={(offset) => update({ offset: offset || '' }, false)}
              />
            </>
          )}
        </div>
      </div>

      <RequestSheet
        candidate={requestFor}
        type="contact"
        onClose={() => setRequestFor(null)}
        onSent={() => {
          setRequestFor(null)
          results.reload()
        }}
      />
    </Layout>
  )
}
