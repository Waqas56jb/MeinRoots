import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import LandingPage from './pages/LandingPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import SignupPage from './pages/SignupPage.jsx'
import ResetPasswordPage from './pages/ResetPasswordPage.jsx'
import VerifyEmailPage from './pages/VerifyEmailPage.jsx'
import UploadPage from './pages/UploadPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import QuestionnairePage from './pages/QuestionnairePage.jsx'
import Spinner from './components/ui/Spinner.jsx'
import { useAuth } from './context/AuthContext.jsx'

/**
 * Sends anonymous visitors to the login gate, remembering where they wanted to
 * go — but only once the session has actually been checked. Redirecting while
 * /auth/me is still in flight would bounce a signed-in user off their own
 * dashboard on every refresh.
 *
 * There is no admin route here on purpose. The review console is a separate
 * application on its own origin: none of it ships in the bundle a candidate
 * downloads, and nothing here links to or reveals its address.
 */
function Protected({ children, gate }) {
  const { isAuthenticated, ready } = useAuth()
  const location = useLocation()

  if (!ready) return <Spinner full />

  if (!isAuthenticated) {
    const next = encodeURIComponent(location.pathname)
    return <Navigate to={`/login?next=${next}${gate ? `&gate=${gate}` : ''}`} replace />
  }

  return children
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

        <Route
          path="/upload"
          element={
            <Protected gate="cv">
              <UploadPage />
            </Protected>
          }
        />
        <Route
          path="/dashboard"
          element={
            <Protected>
              <DashboardPage />
            </Protected>
          }
        />
        <Route
          path="/questionnaire"
          element={
            <Protected>
              <QuestionnairePage />
            </Protected>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
