import type { ErrorToastMessage } from './errorNotifications'

type ErrorToastProps = {
  messages: readonly ErrorToastMessage[]
  onDismiss: (id: number) => void
}

export function ErrorToast({ messages, onDismiss }: ErrorToastProps) {
  if (messages.length === 0) return null

  return (
    <div className="error-toast-stack" aria-live="assertive" aria-relevant="additions">
      {[...messages].reverse().map(({ id, message }) => (
        <div className="error-toast" key={id} role="alert">
          <span>{message}</span>
          <button
            type="button"
            aria-label={`Dismiss error: ${message}`}
            onClick={() => onDismiss(id)}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      ))}
    </div>
  )
}
