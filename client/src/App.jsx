import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import LandingPage from './pages/LandingPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import SignupPage from './pages/SignupPage.jsx'
import ResetPasswordPage from './pages/ResetPasswordPage.jsx'
import VerifyEmailPage from './pages/VerifyEmailPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import MyCvPage from './pages/MyCvPage.jsx'
import ProfilePage from './pages/ProfilePage.jsx'
import ReadinessPage from './pages/ReadinessPage.jsx'
import RecommendationsPage from './pages/RecommendationsPage.jsx'
import QuestionnairePage from './pages/QuestionnairePage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import Spinner from './components/ui/Spinner.jsx'
import { useAuth } from './context/AuthContext.jsx'
import { WorkspaceProvider } from './context/WorkspaceContext.jsx'

/**
 * Sends anonymous visitors to the login gate, remembering where they wanted to
 * go — but only once the session has actually been checked. Redirecting while
 * /auth/me is still in flight would bounce a signed-in user off their own
 * dashboard on every refresh.
 *
 * There is no admin route here. The review console is a separate application on
 * its own origin: none of it ships in the bundle a candidate downloads, and
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

  // One data layer for the whole workspace: the six signed-in pages share a
  // single profile / CV / questionnaire load and a single polling loop, rather
  // than each fetching and polling on its own.
  return <WorkspaceProvider>{children}</WorkspaceProvider>
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

        <Route path="/dashboard" element={<Protected><DashboardPage /></Protected>} />
        <Route path="/cv" element={<Protected gate="cv"><MyCvPage /></Protected>} />
        <Route path="/profile" element={<Protected><ProfilePage /></Protected>} />
        <Route path="/readiness" element={<Protected><ReadinessPage /></Protected>} />
        <Route path="/recommendations" element={<Protected><RecommendationsPage /></Protected>} />
        <Route path="/questionnaire" element={<Protected><QuestionnairePage /></Protected>} />
        <Route path="/settings" element={<Protected><SettingsPage /></Protected>} />

        {/* The upload screen is now part of the CV page. Kept as a redirect so
            the landing-page CTA and any shared link still arrive somewhere. */}
        <Route path="/upload" element={<Navigate to="/cv" replace />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
