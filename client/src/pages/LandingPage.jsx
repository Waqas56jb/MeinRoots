import Navbar from '../components/Navbar.jsx'
import Footer from '../components/Footer.jsx'
import ScrollTop from '../components/ScrollTop.jsx'
import Hero from '../components/Hero.jsx'
import TrustStrip from '../components/home/TrustStrip.jsx'
import CareerPaths from '../components/home/CareerPaths.jsx'
import HowItWorks from '../components/home/HowItWorks.jsx'
import ProductShowcase from '../components/home/ProductShowcase.jsx'
import ReadinessSection from '../components/home/ReadinessSection.jsx'
import SkillGapSection from '../components/home/SkillGapSection.jsx'
import HumanReviewSection from '../components/home/HumanReviewSection.jsx'
import MultilingualCVSection from '../components/home/MultilingualCVSection.jsx'
import DomainSection from '../components/home/DomainSection.jsx'
import PrivacySection from '../components/home/PrivacySection.jsx'
import FinalCTA from '../components/home/FinalCTA.jsx'
import { useI18n } from '../context/I18nContext.jsx'

/**
 * The landing page tells one story, in the order a visitor actually asks the
 * questions:
 *
 *   what is this            Hero (the original one, unchanged)
 *   can I trust it          TrustStrip
 *   is it for my career     CareerPaths
 *   what happens to my CV   HowItWorks
 *   what do I get           ProductShowcase
 *   what does the score mean ReadinessSection
 *   what am I missing       SkillGapSection
 *   can I trust the AI      HumanReviewSection
 *   in my language          MultilingualCVSection
 *   does it understand me   DomainSection
 *   what about my data      PrivacySection
 *   what now                FinalCTA
 *
 * Remounting on a locale change replays the entrance animations in the new
 * language rather than leaving half the page already revealed.
 */
export default function LandingPage() {
  const { locale, t } = useI18n()

  return (
    <div key={locale} className="home">
      <a className="skip-link" href="#main">{t('common.skip')}</a>
      <Navbar />

      <main id="main">
        <Hero />
        <TrustStrip />
        <CareerPaths />
        <HowItWorks />
        <ProductShowcase />
        <ReadinessSection />
        <SkillGapSection />
        <HumanReviewSection />
        <MultilingualCVSection />
        <DomainSection />
        <PrivacySection />
        <FinalCTA />
      </main>

      <Footer />
      <ScrollTop />
    </div>
  )
}
