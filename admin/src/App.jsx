import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import LoginPage from './pages/LoginPage.jsx'
import OverviewPage from './pages/OverviewPage.jsx'
import CandidatesPage from './pages/CandidatesPage.jsx'
import CandidatePage from './pages/CandidatePage.jsx'
import QueuePage from './pages/QueuePage.jsx'
import AuditPage from './pages/AuditPage.jsx'
import { Spinner } from './components/ui.jsx'
import { useAuth } from './context/AuthContext.jsx'

/**
 * Waits for the session check before deciding anything. Redirecting while
 * /auth/me is still in flight would bounce a signed-in admin to the login form
 * on every refresh.
 */
function Protected({ children }) {
  const { isAuthenticated, ready } = useAuth()
  const location = useLocation()

  if (!ready) return <Spinner full />
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  return children
}

/**
 * The login route owns the "already signed in" redirect on its own.
 *
 * Previously LoginPage also called navigate() after a successful sign-in, so
 * the same tick produced two navigations to the same path — the route swapping
 * to <Navigate> while the page it was unmounting fired its own. Leaving exactly
 * one of them in charge removes the race; the page just updates the session and
 * this decides where that leads.
 */
function LoginRoute() {
  const { isAuthenticated, ready } = useAuth()
  const location = useLocation()

  if (!ready) return <Spinner full />
  if (isAuthenticated) return <Navigate to={location.state?.from ?? '/'} replace />
  return <LoginPage />
}

function ScrollReset() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  return (
    <>
      <ScrollReset />
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/" element={<Protected><OverviewPage /></Protected>} />
        <Route path="/candidates" element={<Protected><CandidatesPage /></Protected>} />
        <Route path="/candidates/:userId" element={<Protected><CandidatePage /></Protected>} />
        <Route path="/queue" element={<Protected><QueuePage /></Protected>} />
        <Route path="/audit" element={<Protected><AuditPage /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
