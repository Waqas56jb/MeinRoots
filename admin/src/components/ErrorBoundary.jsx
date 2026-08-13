import { Component } from 'react'
import Icon from './Icon.jsx'

/**
 * Last line of defence.
 *
 * An uncaught error during render unmounts the whole React tree, which is why a
 * crash shows as a blank page and nothing else — no message, no way back. This
 * catches it, shows what happened and offers a reload, so a failure is at worst
 * an annoyance instead of a dead screen.
 *
 * Deliberately not translated: it has to work even if the i18n context is the
 * thing that broke.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Kept in the console for whoever is looking at DevTools, and on the
    // instance so the details can be expanded on screen.
    // eslint-disable-next-line no-console
    console.error('Console crashed:', error, info?.componentStack)
    this.info = info
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="crash">
        <div className="crash__panel">
          <span className="crash__icon"><Icon name="warning" size={26} /></span>
          <h1>Something broke on this screen</h1>
          <p>
            The console hit an unexpected error. Reloading usually clears it. If it keeps
            happening, send this message to the developer.
          </p>

          <pre className="crash__msg">{String(this.state.error?.message || this.state.error)}</pre>

          <div className="crash__act">
            <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
              <Icon name="refresh" size={16} /> Reload
            </button>
            <a className="btn btn--ghost" href={import.meta.env.BASE_URL}>Back to the console</a>
          </div>

          {this.info?.componentStack && (
            <details className="crash__details">
              <summary>Technical detail</summary>
              <pre>{this.info.componentStack.trim()}</pre>
            </details>
          )}
        </div>
      </div>
    )
  }
}
