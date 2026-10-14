import { Component, StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { ErrorToastHost } from './ui/notifications/ErrorToastHost'
import { reportApplicationError } from './errorNotifications'

class ApplicationErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error) {
    reportApplicationError(`Application rendering failed: ${error.message}`)
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="application-error-fallback">
          <p>The application stopped rendering. See the error toast for details.</p>
          <button type="button" onClick={() => window.location.reload()}>
            Reload application
          </button>
        </main>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <>
      <ApplicationErrorBoundary>
        <App />
      </ApplicationErrorBoundary>
      <ErrorToastHost />
    </>
  </StrictMode>,
)
