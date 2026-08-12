import Icon from './ui/Icon.jsx'
import SmartImage from './ui/SmartImage.jsx'
import Reveal from './ui/Reveal.jsx'
import { adminPointKeys, images } from '../data/content.js'
import { useI18n, RichText } from '../context/I18nContext.jsx'

export default function HumanLoop() {
  const { t } = useI18n()

  return (
    <section className="section" id="human-loop">
      <div className="container split">
        <Reveal className="split__media">
          <div className="split__photo split__photo--wide">
            <SmartImage src={images.adminReview} alt="" ratio="4 / 3" />
          </div>
          <div className="flag-card">
            <span className="pill pill--amber"><span className="dot" />{t('admin.flag.tag')}</span>
            <RichText path="admin.flag.text" as="p" />
            <div className="flag-card__foot">
              <span className="avatar-stack"><i /><i /><i /></span>
              <span>{t('admin.flag.foot')}</span>
            </div>
          </div>
        </Reveal>

        <div className="split__copy">
          <Reveal className="eyebrow" as="span"><Icon name="users" />{t('admin.eyebrow')}</Reveal>
          <Reveal as="h2" delay={60}>{t('admin.title')}</Reveal>
          <Reveal as="p" className="lead" delay={110}>{t('admin.lead')}</Reveal>

          <div className="stack-list">
            {adminPointKeys.map((p, i) => (
              <Reveal key={p.key} delay={150 + i * 90}>
                <div className="stack-item">
                  <span className="icon-badge"><Icon name={p.icon} /></span>
                  <div>
                    <h4>{t(`admin.points.${p.key}.title`)}</h4>
                    <p>{t(`admin.points.${p.key}.text`)}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
