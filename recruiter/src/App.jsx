import { Suspense, lazy, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import LoginPage from './pages/auth/LoginPage.jsx'
import RegisterPage from './pages/auth/RegisterPage.jsx'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage.jsx'
import ResetPasswordPage from './pages/auth/ResetPasswordPage.jsx'
import VerifyEmailPage from './pages/auth/VerifyEmailPage.jsx'
import { Spinner } from './components/ui.jsx'
import { useAuth } from './context/AuthContext.jsx'
import { AccountProvider } from './context/AccountContext.jsx'

/**
 * The portal proper is loaded on demand.
 *
 * Someone sitting on the sign-in screen was downloading the candidate search,
 * the pipeline and the billing pages with it — none of which they can reach.
 * Splitting at the session boundary means the public screens carry only
 * themselves.
 */
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage.jsx'))
const CandidatesPage = lazy(() => import('./pages/candidates/CandidatesPage.jsx'))
const CandidateDetailPage = lazy(() => import('./pages/candidates/CandidateDetailPage.jsx'))
const SavedPage = lazy(() => import('./pages/saved/SavedPage.jsx'))
const RequestsPage = lazy(() => import('./pages/requests/RequestsPage.jsx'))
const PipelinePage = lazy(() => import('./pages/pipeline/PipelinePage.jsx'))
const CompanyPage = lazy(() => import('./pages/company/CompanyPage.jsx'))
const TeamPage = lazy(() => import('./pages/team/TeamPage.jsx'))
const BillingPage = lazy(() => import('./pages/billing/BillingPage.jsx'))
const PlansPage = lazy(() => import('./pages/plans/PlansPage.jsx'))
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage.jsx'))

/**
 * Waits for the session check before deciding anything.
 *
 * Redirecting while /auth/me is still in flight would bounce a signed-in
 * recruiter to the login form on every refresh.
 *
 * This is a usability guard and not a security control: it keeps the wrong
 * person out of a workspace that would refuse them anyway. The server decides
 * what any of these routes actually return.
 */
function Protected({ children }) {
  const { isAuthenticated, ready } = useAuth()
  const location = useLocation()

  if (!ready) return <Spinner full />
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }

  // The company, the plan and the entitlement map, read once for every page
  // inside the session rather than per navigation.
  return (
    <AccountProvider>
      <Suspense fallback={<Spinner full />}>{children}</Suspense>
    </AccountProvider>
  )
}

/** The sign-in route owns the "already signed in" redirect, so only one thing does. */
function PublicOnly({ children }) {
  const { isAuthenticated, ready } = useAuth()
  const location = useLocation()

  if (!ready) return <Spinner full />
  if (isAuthenticated) return <Navigate to={location.state?.from ?? '/dashboard'} replace />
  return children
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
        <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
        <Route path="/register" element={<PublicOnly><RegisterPage /></PublicOnly>} />
        <Route path="/forgot-password" element={<PublicOnly><ForgotPasswordPage /></PublicOnly>} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        {/* Opened from the confirmation email; works signed in or out. */}
        <Route path="/verify-email" element={<VerifyEmailPage />} />

        <Route path="/dashboard" element={<Protected><DashboardPage /></Protected>} />
        <Route path="/candidates" element={<Protected><CandidatesPage /></Protected>} />
        <Route path="/candidates/:id" element={<Protected><CandidateDetailPage /></Protected>} />
        <Route path="/saved" element={<Protected><SavedPage /></Protected>} />
        <Route path="/requests" element={<Protected><RequestsPage /></Protected>} />
        <Route path="/pipeline" element={<Protected><PipelinePage /></Protected>} />
        <Route path="/company" element={<Protected><CompanyPage /></Protected>} />
        <Route path="/team" element={<Protected><TeamPage /></Protected>} />
        <Route path="/billing" element={<Protected><BillingPage /></Protected>} />
        <Route path="/plans" element={<Protected><PlansPage /></Protected>} />
        <Route path="/settings" element={<Protected><SettingsPage /></Protected>} />

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  )
}
