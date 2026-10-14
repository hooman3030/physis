import { useEffect, useSyncExternalStore } from 'react'
import {
  dismissApplicationError,
  getApplicationErrors,
  reportApplicationError,
  subscribeToApplicationErrors,
} from '../../errorNotifications'
import { ErrorToast } from './ErrorToast'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function ErrorToastHost() {
  const messages = useSyncExternalStore(
    subscribeToApplicationErrors,
    getApplicationErrors,
    getApplicationErrors,
  )

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      const message = event.error == null ? event.message : errorMessage(event.error)
      reportApplicationError(`Unexpected application error: ${message || 'Unknown error'}`)
    }
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      reportApplicationError(`Unexpected asynchronous error: ${errorMessage(event.reason)}`)
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])

  return <ErrorToast messages={messages} onDismiss={dismissApplicationError} />
}
