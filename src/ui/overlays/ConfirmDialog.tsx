import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { reportApplicationError } from '../../errorNotifications'
import { PrimaryButton } from '../primitives/PrimaryButton'

type ConfirmDialogProps = {
  title: string
  description: string
  confirmLabel: string
  onConfirm: () => Promise<void>
  onCancel: () => void
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [confirming, setConfirming] = useState(false)
  const [burstActive, setBurstActive] = useState(false)
  const titleId = `confirm-dialog-title-${useId().replace(/:/g, '')}`
  const descriptionId = `confirm-dialog-description-${useId().replace(/:/g, '')}`
  const dialogRef = useRef<HTMLElement | null>(null)
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null)
  const timeoutRef = useRef<number | null>(null)

  useEffect(() => {
    const previousFocus = document.activeElement
    cancelButtonRef.current?.focus()
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus()
    }
  }, [])

  const handleConfirm = () => {
    if (confirming) return
    setConfirming(true)
    const reducedMotion = prefersReducedMotion()
    setBurstActive(!reducedMotion)

    timeoutRef.current = window.setTimeout(
      () => {
        void onConfirm().catch((error: unknown) => {
          reportApplicationError(
            `Could not complete the deletion: ${error instanceof Error ? error.message : String(error)}`,
          )
          setConfirming(false)
          setBurstActive(false)
        })
      },
      reducedMotion ? 0 : 620,
    )
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape' && !confirming) {
      event.preventDefault()
      onCancel()
      return
    }
    if (event.key !== 'Tab') return
    const confirmButton =
      dialogRef.current?.querySelector<HTMLButtonElement>('.confirm-dialog-delete')
    if (event.shiftKey && document.activeElement === cancelButtonRef.current) {
      event.preventDefault()
      confirmButton?.focus()
    } else if (!event.shiftKey && document.activeElement === confirmButton) {
      event.preventDefault()
      cancelButtonRef.current?.focus()
    }
  }

  return (
    <div
      className="confirm-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !confirming) onCancel()
      }}
    >
      <section
        className="confirm-dialog surface shape-panel"
        role="alertdialog"
        ref={dialogRef}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onKeyDown={handleKeyDown}
      >
        <div
          className={`confirm-dialog-burst${burstActive ? ' confirm-dialog-burst-active' : ''}`}
          aria-hidden="true"
        >
          <svg viewBox="0 0 64 64">
            <path d="M32 3v14m0 30v14M3 32h14m30 0h14M11.5 11.5l10 10m21 21 10 10m0-41-10 10m-21 21-10 10M32 22l3.5 7.5L44 32l-8.5 3-3.5 8-3.5-8-8.5-3 8.5-2.5L32 22Z" />
            <circle cx="32" cy="32" r="4" />
          </svg>
          <span className="confirm-dialog-spark confirm-dialog-spark-one" />
          <span className="confirm-dialog-spark confirm-dialog-spark-two" />
          <span className="confirm-dialog-spark confirm-dialog-spark-three" />
          <span className="confirm-dialog-spark confirm-dialog-spark-four" />
        </div>
        <h2 id={titleId}>{title}</h2>
        <p id={descriptionId}>{description}</p>
        <div className="confirm-dialog-actions">
          <button
            ref={cancelButtonRef}
            type="button"
            className="button--quiet"
            disabled={confirming}
            onClick={onCancel}
          >
            Cancel
          </button>
          <PrimaryButton
            type="button"
            className="confirm-dialog-delete"
            disabled={confirming}
            animateOnClick={false}
            onClick={handleConfirm}
          >
            {confirming ? 'Deleting…' : confirmLabel}
          </PrimaryButton>
        </div>
      </section>
    </div>
  )
}
