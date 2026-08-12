import Navbar from '../components/Navbar.jsx'
import Hero from '../components/Hero.jsx'
import TrustBar from '../components/TrustBar.jsx'
import Goals from '../components/Goals.jsx'
import HowItWorks from '../components/HowItWorks.jsx'
import Features from '../components/Features.jsx'
import Domains from '../components/Domains.jsx'
import Gallery from '../components/Gallery.jsx'
import Languages from '../components/Languages.jsx'
import HumanLoop from '../components/HumanLoop.jsx'
import Testimonials from '../components/Testimonials.jsx'
import Pricing from '../components/Pricing.jsx'
import Faq from '../components/Faq.jsx'
import CallToAction from '../components/CallToAction.jsx'
import Footer from '../components/Footer.jsx'
import ScrollTop from '../components/ScrollTop.jsx'
import { useI18n } from '../context/I18nContext.jsx'

export default function LandingPage() {
  const { locale, t } = useI18n()

  return (
    // Remounting on locale change replays the entrance animations in the new language.
    <div key={locale}>
      <a className="skip-link" href="#main">{t('common.skip')}</a>
      <Navbar />
      <main id="main">
        <Hero />
        <TrustBar />
        <Goals />
        <HowItWorks />
        <Features />
        <Domains />
        <Languages />
        <HumanLoop />
        <Gallery />
        <Testimonials />
        <Pricing />
        <Faq />
        <CallToAction />
      </main>
      <Footer />
      <ScrollTop />
    </div>
  )
}
