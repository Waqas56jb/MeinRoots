import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import ErrorBoundary from './components/ui/ErrorBoundary.jsx'
import { I18nProvider } from './context/I18nContext.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import './styles/global.css'
import './styles/sections.css'
import './styles/footer.css'
import './styles/auth.css'
import './styles/app.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* Outside the providers, so a crash inside one is still caught and shown
        rather than unmounting the tree into a blank page. */}
    <ErrorBoundary>
      <BrowserRouter>
        <I18nProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </I18nProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
)
