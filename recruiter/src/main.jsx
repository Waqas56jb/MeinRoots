import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { I18nProvider } from './context/I18nContext.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import './styles/base.css'
import './styles/portal.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* Outside every provider, so a crash in one of them is still caught and
        shown rather than unmounting the tree into a blank page. */}
    <ErrorBoundary>
      {/* BASE_URL is whatever `base` was at build time, so the router and the
          asset paths can never drift apart. */}
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <I18nProvider>
          <AuthProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </AuthProvider>
        </I18nProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
)
