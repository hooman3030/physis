import { useEffect, useRef, useState } from 'react'
import {
  ControlApiError,
  completePairing,
  deleteImprint,
  dismissPairingPin,
  getPairingStatus,
  getPresence,
  listCodeNodes,
  listImprints,
  requestPairingPin,
  saveControlApiToken,
  selectCode,
  selectImprint,
  type CodeNodeRecord,
  type ImprintRecord,
  type PairingStatus,
  type PresenceSnapshot,
} from '../controlClient'
import { reportApplicationError } from '../errorNotifications'
import {
  confirmAndDeleteLineageImprints,
  removeDeletedImprintAndReparentChildren,
} from './lineageImprintDeletion'
import {
  getInitialLineageSelection,
  LineageExplorer,
  type LineageSelection,
} from '../ui/archive/LineageExplorer'
import { RemoteAccessPairing } from '../ui/overlays/RemoteAccessPairing'

type ControlStatus = 'connecting' | 'connected' | 'offline'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function LineageRoute() {
  const [codeNodes, setCodeNodes] = useState<readonly CodeNodeRecord[]>([])
  const [imprints, setImprints] = useState<readonly ImprintRecord[]>([])
  const [presence, setPresence] = useState<PresenceSnapshot | null>(null)
  const [selection, setSelection] = useState<LineageSelection | null>(null)
  const [controlStatus, setControlStatus] = useState<ControlStatus>('connecting')
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [authenticationRequired, setAuthenticationRequired] = useState(false)
  const [pairingStatus, setPairingStatus] = useState<PairingStatus | null>(null)
  const [reloadVersion, setReloadVersion] = useState(0)
  const pairingStatusFailureRef = useRef(false)

  useEffect(() => {
    let disposed = false
    setLoading(true)
    setLoadFailed(false)

    void Promise.all([getPresence(), listCodeNodes(), listImprints()])
      .then(([nextPresence, nextCodeNodes, nextImprints]) => {
        if (disposed) return
        setPresence(nextPresence)
        setCodeNodes(nextCodeNodes)
        setImprints(nextImprints)
        const initialSelection = getInitialLineageSelection(nextPresence, nextImprints)
        if (initialSelection !== null) {
          setSelection((current) => current ?? initialSelection)
        }
        setAuthenticationRequired(false)
        setControlStatus('connected')
      })
      .catch((error: unknown) => {
        if (disposed) return
        setLoadFailed(true)
        setControlStatus('offline')
        if (error instanceof ControlApiError && error.status === 401) {
          setAuthenticationRequired(true)
          return
        }
        reportApplicationError(`Could not load the Lineage Explorer: ${errorMessage(error)}`)
      })
      .finally(() => {
        if (!disposed) setLoading(false)
      })

    return () => {
      disposed = true
    }
  }, [reloadVersion])

  useEffect(() => {
    if (controlStatus !== 'connected' && !authenticationRequired) return

    let disposed = false
    let loadingStatus = false
    const refreshPairingStatus = async () => {
      if (loadingStatus) return
      loadingStatus = true
      try {
        const status = await getPairingStatus()
        if (!disposed) {
          setPairingStatus(status)
          pairingStatusFailureRef.current = false
        }
      } catch (error) {
        if (!disposed && !pairingStatusFailureRef.current) {
          reportApplicationError(`Could not check pairing status: ${errorMessage(error)}`)
          pairingStatusFailureRef.current = true
        }
      } finally {
        loadingStatus = false
      }
    }

    void refreshPairingStatus()
    const timer = window.setInterval(() => void refreshPairingStatus(), 2000)
    return () => {
      disposed = true
      window.clearInterval(timer)
    }
  }, [authenticationRequired, controlStatus])

  const handleRequestPin = async (): Promise<boolean> => {
    try {
      await requestPairingPin()
      return true
    } catch (error) {
      reportApplicationError(`Could not request a pairing PIN: ${errorMessage(error)}`)
      return false
    }
  }

  const handlePair = async (pin: string): Promise<boolean> => {
    try {
      saveControlApiToken(await completePairing(pin))
    } catch (error) {
      reportApplicationError(`Could not pair this browser: ${errorMessage(error)}`)
      return false
    }
    setAuthenticationRequired(false)
    setReloadVersion((version) => version + 1)
    return true
  }

  const handleDismissPin = async () => {
    try {
      await dismissPairingPin()
      setPairingStatus(null)
    } catch (error) {
      reportApplicationError(`Could not cancel pairing: ${errorMessage(error)}`)
    }
  }

  const handleActivate = async (selected: LineageSelection) => {
    try {
      const snapshot =
        selected.kind === 'code' ? await selectCode(selected.id) : await selectImprint(selected.id)
      setPresence(snapshot)
    } catch (error) {
      if (error instanceof ControlApiError && error.status === 401) {
        setAuthenticationRequired(true)
        setControlStatus('offline')
        reportApplicationError('This browser needs to be paired with the installation.')
        return
      }
      reportApplicationError(
        `Could not select ${selected.kind} ${selected.id}: ${errorMessage(error)}`,
      )
      if (!(error instanceof ControlApiError)) setControlStatus('offline')
    }
  }

  const handleDeleteImprints = (imprintIds: readonly string[]): Promise<readonly string[]> => {
    if (imprintIds.length === 0) return Promise.resolve([])
    if (controlStatus !== 'connected' || authenticationRequired) {
      reportApplicationError(
        'The local control API is unavailable; selected Imprints were not deleted.',
      )
      return Promise.resolve([])
    }

    return confirmAndDeleteLineageImprints(imprintIds, {
      confirm: (message) => window.confirm(message),
      deleteImprint,
      onDeleted: (imprintId) => {
        setImprints((current) => removeDeletedImprintAndReparentChildren(current, imprintId))
        setSelection((current) =>
          current?.kind === 'imprint' && current.id === imprintId ? null : current,
        )
      },
      onAuthenticationRequired: () => {
        setAuthenticationRequired(true)
        setControlStatus('offline')
      },
      onControlApiUnavailable: () => setControlStatus('offline'),
      reportError: reportApplicationError,
    })
  }

  return (
    <main className="lineage-page">
      <RemoteAccessPairing
        required={authenticationRequired}
        pairingStatus={pairingStatus}
        onRequestPin={handleRequestPin}
        onSubmit={handlePair}
        onDismissPin={handleDismissPin}
      />
      <LineageExplorer
        codeNodes={codeNodes}
        imprints={imprints}
        presence={presence}
        selection={selection}
        controlStatus={controlStatus}
        loading={loading}
        loadFailed={loadFailed}
        authenticationRequired={authenticationRequired}
        onSelect={setSelection}
        onActivate={(selected) => void handleActivate(selected)}
        onDeleteImprints={handleDeleteImprints}
        onRetry={() => setReloadVersion((version) => version + 1)}
      />
    </main>
  )
}
