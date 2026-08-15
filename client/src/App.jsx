import { Suspense, lazy, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import LandingPage from './pages/LandingPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import SignupPage from './pages/SignupPage.jsx'
import ResetPasswordPage from './pages/ResetPasswordPage.jsx'
import VerifyEmailPage from './pages/VerifyEmailPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import TermsPage from './pages/TermsPage.jsx'
import PrivacyPage from './pages/PrivacyPage.jsx'
import Spinner from './components/ui/Spinner.jsx'
import { useAuth } from './context/AuthContext.jsx'
import { WorkspaceProvider } from './context/WorkspaceContext.jsx'

/**
 * The workspace is loaded on demand.
 *
 * Someone who only reads the landing page or signs in was downloading the whole
 * signed-in product with it — the profile editor, the questionnaire, the
 * readiness charts, none of which they can reach. Splitting at the route
 * boundary means the marketing and auth pages carry only themselves, and the
 * workspace arrives when a session actually exists.
 */
const DashboardPage = lazy(() => import('./pages/DashboardPage.jsx'))
const MyCvPage = lazy(() => import('./pages/MyCvPage.jsx'))
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx'))
const ReadinessPage = lazy(() => import('./pages/ReadinessPage.jsx'))
const RecommendationsPage = lazy(() => import('./pages/RecommendationsPage.jsx'))
const QuestionnairePage = lazy(() => import('./pages/QuestionnairePage.jsx'))
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx'))
const RecruitmentPage = lazy(() => import('./pages/RecruitmentPage.jsx'))

/**
 * Sends anonymous visitors to the login gate, remembering where they wanted to
 * go — but only once the session has actually been checked. Redirecting while
 * /auth/me is still in flight would bounce a signed-in user off their own
 * dashboard on every refresh.
 *
 * There is no admin route here. The review console is a separate application on
 * its own hostname: none of it ships in the bundle a candidate downloads, and
 * nothing here links to or reveals its address.
 */
function Protected({ children, gate }) {
  const { isAuthenticated, ready } = useAuth()
  const location = useLocation()

  if (!ready) return <Spinner full />

  if (!isAuthenticated) {
    const next = encodeURIComponent(location.pathname)
    return <Navigate to={`/login?next=${next}${gate ? `&gate=${gate}` : ''}`} replace />
  }

  // One data layer for the whole workspace: the signed-in pages share a single
  // profile / CV / questionnaire load and a single polling loop, rather than
  // each fetching and polling on its own.
  //
  // Suspense sits inside the auth check so the spinner shown while a chunk
  // downloads is the same one shown while the session is verified.
  return (
    <WorkspaceProvider>
      <Suspense fallback={<Spinner full />}>{children}</Suspense>
    </WorkspaceProvider>
  )
}

/** Restores scroll position on navigation (hash links keep their own behaviour). */
function ScrollReset() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0)
  }, [pathname, hash])
  return null
}

export default function App() {
  return (
    <>
      <ScrollReset />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        {/* Opened from the confirmation email; works signed in or out. */}
        <Route path="/verify-email" element={<VerifyEmailPage />} />

        {/* Public and unauthenticated on purpose: someone has to be able to
            read what they are agreeing to before they have an account. */}
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />

        <Route path="/dashboard" element={<Protected><DashboardPage /></Protected>} />
        <Route path="/cv" element={<Protected gate="cv"><MyCvPage /></Protected>} />
        <Route path="/profile" element={<Protected><ProfilePage /></Protected>} />
        <Route path="/readiness" element={<Protected><ReadinessPage /></Protected>} />
        <Route path="/recommendations" element={<Protected><RecommendationsPage /></Protected>} />
        <Route path="/questionnaire" element={<Protected><QuestionnairePage /></Protected>} />
        <Route path="/settings" element={<Protected><SettingsPage /></Protected>} />
        <Route path="/recruitment" element={<Protected><RecruitmentPage /></Protected>} />

        {/* The upload screen is now part of the CV page. Kept as a redirect so
            the landing-page CTA and any shared link still arrive somewhere. */}
        <Route path="/upload" element={<Navigate to="/cv" replace />} />

        {/* A real 404. Redirecting silently to the landing page made a broken
            link look like the site had swallowed it. */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  )
}
