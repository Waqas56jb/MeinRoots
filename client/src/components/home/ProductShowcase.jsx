import { useState } from 'react'
import Icon from '../ui/Icon.jsx'
import Reveal from '../ui/Reveal.jsx'
import { useI18n } from '../../context/I18nContext.jsx'

/**
 * What the candidate actually receives.
 *
 * Four tabs mirroring four real pages of the signed-in product, drawn in the
 * same visual language as those pages so the preview and the thing itself
 * agree. This is storytelling, not the dashboard: no data is fetched, nothing
 * is interactive beyond switching panels, and the panel is labelled an example.
 */
const TABS = ['profile', 'readiness', 'gaps', 'next']

export default function ProductShowcase() {
  const { t } = useI18n()
  const [tab, setTab] = useState('profile')

  return (
    <section className="section showcase" id="what-you-get">
      <div className="container">
        <Reveal className="shead">
          <span className="shead__eyebrow">{t('home.showcase.eyebrow')}</span>
          <h2>{t('home.showcase.title')}</h2>
          <p>{t('home.showcase.lead')}</p>
        </Reveal>

        <Reveal className="showcase__frame">
          <div className="showcase__tabs" role="tablist" aria-label={t('home.showcase.title')}>
            {TABS.map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                className={tab === key ? 'is-on' : ''}
                onClick={() => setTab(key)}
              >
                {t(`home.showcase.tabs.${key}`)}
              </button>
            ))}
          </div>

          <div className="showcase__panel" role="tabpanel">
            <span className="showcase__tag">
              <Icon name="info" size={13} />
              {t('home.hero.exampleLabel')}
            </span>

            {tab === 'profile' && <ProfilePanel t={t} />}
            {tab === 'readiness' && <ReadinessPanel t={t} />}
            {tab === 'gaps' && <GapsPanel t={t} />}
            {tab === 'next' && <NextPanel t={t} />}
          </div>
        </Reveal>
      </div>
    </section>
  )
}

function ProfilePanel({ t }) {
  return (
    <div className="sc sc--profile">
      <div className="sc__id">
        <span className="sc__avatar" aria-hidden="true">AH</span>
        <div>
          <strong>{t('home.showcase.profile.headline')}</strong>
          <span>{t('home.showcase.profile.location')}</span>
        </div>
        <span className="sc__pill sc__pill--brand">
          <Icon name="compass" size={12} />
          {t('home.showcase.profile.domain')}
        </span>
      </div>

      <dl className="sc__facts">
        <div><dt>{t('home.showcase.profile.experienceLabel')}</dt><dd>{t('home.showcase.profile.experience')}</dd></div>
        <div><dt>{t('home.showcase.profile.specLabel')}</dt><dd>{t('home.showcase.profile.spec')}</dd></div>
        <div><dt>{t('home.showcase.profile.eduLabel')}</dt><dd>{t('home.showcase.profile.edu')}</dd></div>
        <div><dt>{t('home.showcase.profile.langLabel')}</dt><dd>{t('home.showcase.profile.lang')}</dd></div>
      </dl>

      <div className="sc__skills">
        <span className="sc__skillsLabel">{t('home.showcase.profile.evidenced')}</span>
        <ul>
          {['Intensive care', 'Wound management', 'Patient documentation', 'Team leadership'].map((s) => (
            <li key={s}><Icon name="check" size={11} />{s}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function ReadinessPanel({ t }) {
  const factors = [
    { key: 'experience', value: 88 },
    { key: 'education', value: 82 },
    { key: 'skills', value: 74 },
    { key: 'language', value: 45, warn: true },
  ]
  return (
    <div className="sc sc--readiness">
      <div className="sc__scoreBlock">
        <span className="sc__score">78</span>
        <span className="sc__scoreMeta">
          <strong>{t('home.hero.band')}</strong>
          <span>{t('goals.items.germany.title')}</span>
        </span>
      </div>
      <ul className="sc__meters">
        {factors.map((f) => (
          <li key={f.key}>
            <span>{t(`home.factors.${f.key}`)}</span>
            <span className="sc__meter">
              <span className={`sc__meterFill ${f.warn ? 'is-warn' : ''}`} style={{ width: `${f.value}%` }} />
            </span>
            <em>{f.value}</em>
          </li>
        ))}
      </ul>
      <p className="sc__foot"><Icon name="info" size={13} />{t('home.showcase.readiness.foot')}</p>
    </div>
  )
}

function GapsPanel({ t }) {
  const gaps = [
    { key: 'german', tone: 'critical' },
    { key: 'recognition', tone: 'important' },
    { key: 'certificate', tone: 'nice' },
  ]
  return (
    <div className="sc sc--gaps">
      <ul className="sc__gaps">
        {gaps.map((g) => (
          <li key={g.key} className={`sc__gap sc__gap--${g.tone}`}>
            <div className="sc__gapHead">
              <strong>{t(`home.showcase.gaps.${g.key}.skill`)}</strong>
              <span className="sc__pill">{t(`home.showcase.gaps.${g.key}.tag`)}</span>
            </div>
            <p className="sc__gapLevels">
              <span>{t(`home.showcase.gaps.${g.key}.from`)}</span>
              <Icon name="arrowRight" size={13} />
              <strong>{t(`home.showcase.gaps.${g.key}.to`)}</strong>
            </p>
            <p className="sc__gapAction">
              <Icon name="bolt" size={13} />
              {t(`home.showcase.gaps.${g.key}.action`)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}

function NextPanel({ t }) {
  const items = [
    { key: 'german', icon: 'translate', tone: 'critical' },
    { key: 'questions', icon: 'clipboard', tone: 'critical' },
    { key: 'certificate', icon: 'award', tone: 'important' },
    { key: 'relocation', icon: 'pin', tone: 'nice' },
  ]
  return (
    <ul className="sc sc--next">
      {items.map((item) => (
        <li key={item.key} className={`sc__next sc__next--${item.tone}`}>
          <span className="sc__nextIcon"><Icon name={item.icon} size={16} /></span>
          <div>
            <strong>{t(`home.showcase.next.${item.key}.title`)}</strong>
            <span>{t(`home.showcase.next.${item.key}.text`)}</span>
          </div>
          <span className="sc__pill">{t(`home.showcase.priority.${item.tone}`)}</span>
        </li>
      ))}
    </ul>
  )
}
