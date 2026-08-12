import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import LandingPage from './pages/LandingPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import SignupPage from './pages/SignupPage.jsx'
import ResetPasswordPage from './pages/ResetPasswordPage.jsx'
import UploadPage from './pages/UploadPage.jsx'
import { useAuth } from './context/AuthContext.jsx'

/** Sends anonymous visitors to the login gate, remembering where they wanted to go. */
function Protected({ children, gate }) {
  const { isAuthenticated } = useAuth()
  const location = useLocation()
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
        <Route
          path="/upload"
          element={
            <Protected gate="cv">
              <UploadPage />
            </Protected>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
