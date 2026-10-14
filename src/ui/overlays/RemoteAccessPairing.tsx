import { useState, type FormEvent } from 'react'
import type { PairingStatus } from '../../controlClient'

type RemoteAccessPairingProps = {
  required: boolean
  pairingStatus: PairingStatus | null
  onRequestPin: () => Promise<boolean>
  onSubmit: (pin: string) => Promise<boolean>
  onDismissPin: () => Promise<void>
}

export function RemoteAccessPairing({
  required,
  pairingStatus,
  onRequestPin,
  onSubmit,
  onDismissPin,
}: RemoteAccessPairingProps) {
  const [pin, setPin] = useState('')
  const [requested, setRequested] = useState(false)
  const [busy, setBusy] = useState(false)

  const requestPin = async () => {
    setBusy(true)
    try {
      if (await onRequestPin()) setRequested(true)
    } finally {
      setBusy(false)
    }
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    try {
      if (await onSubmit(pin)) setPin('')
    } finally {
      setBusy(false)
    }
  }

  if (!required && pairingStatus === null) return null

  return (
    <>
      {required && (
        <form className="remote-access-pairing surface shape-panel" onSubmit={submit}>
          <p className="eyebrow">Remote studio</p>
          <h1>Pair this browser</h1>
          <p>
            Request a PIN. It will appear on the installation display; enter it here to connect.
          </p>
          <button type="button" disabled={busy} onClick={() => void requestPin()}>
            {requested ? 'Request another PIN' : 'Request PIN'}
          </button>
          {requested && (
            <>
              <p>Check the installation display. The PIN expires after five minutes.</p>
              <label htmlFor="pairing-pin">Pairing PIN</label>
              <input
                id="pairing-pin"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                autoComplete="one-time-code"
                maxLength={6}
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))}
              />
              <button type="submit" disabled={busy || pin.length !== 6}>
                Connect
              </button>
            </>
          )}
        </form>
      )}
      {pairingStatus !== null && (
        <aside className="remote-pairing-code surface shape-panel" role="status" aria-live="polite">
          <p className="eyebrow">Device pairing requested</p>
          <p>Enter this PIN on the requesting device before it expires.</p>
          <strong>{pairingStatus.pin}</strong>
          <button type="button" disabled={busy} onClick={() => void onDismissPin()}>
            Cancel pairing
          </button>
        </aside>
      )}
    </>
  )
}
