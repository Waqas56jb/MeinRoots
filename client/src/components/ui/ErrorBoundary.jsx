import { Component } from 'react'
import Icon from './Icon.jsx'

/**
 * Last line of defence.
 *
 * An uncaught render error unmounts the whole React tree, which is why a crash
 * shows as a blank page with no message and no way back. This catches it and
 * offers a reload instead.
 *
 * Deliberately untranslated: it has to work even when the i18n context is the
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
    // eslint-disable-next-line no-console
    console.error('App crashed:', error, info?.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="crash">
        <div className="crash__panel">
          <span className="crash__icon"><Icon name="alert" size={26} /></span>
          <h1>Something went wrong</h1>
          <p>This page hit an unexpected error. Reloading usually fixes it.</p>
          <pre className="crash__msg">{String(this.state.error?.message || this.state.error)}</pre>
          <div className="crash__act">
            <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
              Reload
            </button>
            <a className="btn btn--ghost" href="/">Back to the start</a>
          </div>
        </div>
      </div>
    )
  }
}
