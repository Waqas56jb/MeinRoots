import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import ErrorBoundary from './components/ui/ErrorBoundary.jsx'
import { I18nProvider } from './context/I18nContext.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { watchForNewBuild } from './lib/version.js'
import './styles/global.css'

// A tab left open across a deploy otherwise keeps running the old build, which
// looks exactly like a fix that never shipped.
watchForNewBuild()
import './styles/sections.css'
import './styles/home.css'
import './styles/footer.css'
import './styles/auth.css'
import './styles/app.css'
import './styles/workspace.css'
import './styles/pages.css'
// Last on purpose: the touch-target floor has to win over every file above it.
import './styles/touch.css'

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
