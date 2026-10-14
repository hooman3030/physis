import { useCallback, useEffect, useRef, useState } from 'react'
import { ArtworkCanvas } from '../ui/artwork/ArtworkCanvas'
import {
  ControlApiError,
  completePairing,
  createImprint,
  deleteImprint,
  dismissPairingPin,
  getPairingStatus,
  getPresence,
  listImprints,
  requestPairingPin,
  saveControlApiToken,
  selectCode,
  selectImprint,
  setGenes as updateApiGenes,
  subscribeToPresence,
  type ImprintRecord,
  type PairingStatus,
  type PresenceSnapshot,
} from '../controlClient'
import {
  loadSettings,
  sanitizeGeneValues,
  saveSettings,
  type ArtworkSettings,
} from '../persistence'
import { reportApplicationError } from '../errorNotifications'
import { ImprintArchive } from '../ui/archive/ImprintArchive'
import { DevelopmentOverlay } from '../ui/overlays/DevelopmentOverlay'
import { RemoteAccessPairing } from '../ui/overlays/RemoteAccessPairing'
import { SeedControls } from '../ui/artwork/SeedControls'
import type { P5Seed } from '../seeds/p5/types'
import type { ArtworkGeneValues } from '../seeds/types'
import { artworkSeeds, defaultArtworkSeed } from '../seeds/registry'
import '../ui/styles.css'

type ControlStatus = 'connecting' | 'connected' | 'offline'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function App() {
  const [initialSettings] = useState(() => {
    const errors: string[] = []
    const settings = loadSettings(artworkSeeds, defaultArtworkSeed, (message) =>
      errors.push(message),
    )
    return { settings, errors }
  })
  const [settings, setSettings] = useState<ArtworkSettings<P5Seed>>(initialSettings.settings)
  const [controlsOpen, setControlsOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [controlStatus, setControlStatus] = useState<ControlStatus>('connecting')
  const [fps, setFps] = useState<number | null>(null)
  const [authenticationRequired, setAuthenticationRequired] = useState(false)
  const [pairingStatus, setPairingStatus] = useState<PairingStatus | null>(null)
  const [credentialRevision, setCredentialRevision] = useState(0)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [imprints, setImprints] = useState<readonly ImprintRecord[]>([])
  const [activeImprintId, setActiveImprintId] = useState<string | null>(null)
  const [archiveLoading, setArchiveLoading] = useState(false)
  const [archiveLoadFailed, setArchiveLoadFailed] = useState(false)
  const settingsRef = useRef(settings)
  const statusRef = useRef(controlStatus)
  const authenticationRequiredRef = useRef(false)
  const pairingStatusFailureRef = useRef(false)
  const revisionRef = useRef(-1)
  const saveFeedbackTimer = useRef<number | null>(null)
  const { seed } = settings
  const geneValues = settings.genesBySeed[seed.id]

  settingsRef.current = settings
  statusRef.current = controlStatus

  useEffect(() => {
    for (const message of initialSettings.errors) reportApplicationError(message)
  }, [initialSettings])

  useEffect(() => {
    saveSettings(settings, reportApplicationError)
  }, [settings])

  useEffect(
    () => () => {
      if (saveFeedbackTimer.current !== null) {
        window.clearTimeout(saveFeedbackTimer.current)
      }
    },
    [],
  )

  const applyPresence = useCallback((snapshot: PresenceSnapshot, force = false) => {
    if (!force && snapshot.revision < revisionRef.current) return
    revisionRef.current = snapshot.revision
    setActiveImprintId(snapshot.imprint?.id ?? null)
    if (snapshot.code === null) return
    const activeSeed = artworkSeeds.find((candidate) => candidate.id === snapshot.code?.id)
    const module = snapshot.module
    if (activeSeed === undefined || module === null || module.id !== activeSeed.id) {
      reportApplicationError(
        `Active module ${snapshot.code.id} is unavailable in this frontend build.`,
      )
      return
    }
    if (module.runtime !== activeSeed.runtime) {
      reportApplicationError(
        `Active module ${snapshot.code.id} requires the ${module.runtime} runtime, but this frontend provides ${activeSeed.runtime}.`,
      )
      return
    }

    setSettings((current) => ({
      ...current,
      seed: activeSeed,
      genesBySeed: {
        ...current.genesBySeed,
        [activeSeed.id]: sanitizeGeneValues(activeSeed, snapshot.genes),
      },
    }))
  }, [])

  const requirePairing = useCallback((error: unknown): boolean => {
    if (!(error instanceof ControlApiError) || error.status !== 401) return false
    const alreadyRequired = authenticationRequiredRef.current
    authenticationRequiredRef.current = true
    setAuthenticationRequired(true)
    statusRef.current = 'offline'
    setControlStatus('offline')
    if (!alreadyRequired)
      reportApplicationError('This browser needs to be paired with the installation.')
    return true
  }, [])

  useEffect(() => {
    if (controlStatus !== 'connected' && !authenticationRequired) return

    let disposed = false
    let loading = false
    const refreshPairingStatus = async () => {
      if (loading) return
      loading = true
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
        loading = false
      }
    }

    void refreshPairingStatus()
    const timer = window.setInterval(() => void refreshPairingStatus(), 2000)
    return () => {
      disposed = true
      window.clearInterval(timer)
    }
  }, [authenticationRequired, controlStatus, credentialRevision])

  const refreshImprints = useCallback(async () => {
    if (statusRef.current !== 'connected') {
      setArchiveLoadFailed(true)
      reportApplicationError('The local control API is unavailable.')
      return
    }

    setArchiveLoading(true)
    setArchiveLoadFailed(false)
    try {
      const records = await listImprints()
      setImprints([...records].sort((left, right) => right.createdAt.localeCompare(left.createdAt)))
    } catch (error) {
      setArchiveLoadFailed(true)
      if (!requirePairing(error)) {
        reportApplicationError(`Could not load Imprints: ${errorMessage(error)}`)
      }
      if (!(error instanceof ControlApiError)) {
        statusRef.current = 'offline'
        setControlStatus('offline')
      }
    } finally {
      setArchiveLoading(false)
    }
  }, [requirePairing])

  useEffect(() => {
    if (archiveOpen && controlStatus === 'connected') void refreshImprints()
  }, [archiveOpen, controlStatus, refreshImprints])

  useEffect(() => {
    let disposed = false
    let connecting = false
    let closeEvents: (() => void) | null = null
    authenticationRequiredRef.current = false
    setAuthenticationRequired(false)

    const setStatus = (status: ControlStatus) => {
      statusRef.current = status
      setControlStatus(status)
    }

    const connect = async (initial: boolean) => {
      if (
        disposed ||
        connecting ||
        statusRef.current === 'connected' ||
        authenticationRequiredRef.current
      ) {
        return
      }
      connecting = true
      if (initial) setStatus('connecting')

      try {
        let snapshot = await getPresence()
        if (snapshot.code === null) {
          snapshot = await selectCode(settingsRef.current.seed.id)
        }
        if (disposed) return
        applyPresence(snapshot, true)
        setStatus('connected')
        if (closeEvents === null) {
          closeEvents = subscribeToPresence(
            (nextSnapshot) => applyPresence(nextSnapshot),
            () => {
              authenticationRequiredRef.current = false
              setAuthenticationRequired(false)
              setStatus('connected')
            },
            (error) => {
              setStatus('offline')
              if (!requirePairing(error)) reportApplicationError(error.message)
            },
          )
        }
      } catch (error) {
        if (!disposed) {
          setStatus('offline')
          if (!requirePairing(error)) {
            reportApplicationError(`Control API unavailable: ${errorMessage(error)}`)
          }
        }
      } finally {
        connecting = false
      }
    }

    void connect(true)
    const retryTimer = window.setInterval(() => {
      if (statusRef.current !== 'connected') void connect(false)
    }, 5000)

    return () => {
      disposed = true
      window.clearInterval(retryTimer)
      closeEvents?.()
    }
  }, [applyPresence, credentialRevision, requirePairing])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setControlsOpen(false)
        setArchiveOpen(false)
        return
      }

      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || target.matches('input, select, textarea'))
      ) {
        return
      }

      if (
        event.code === 'KeyC' &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.repeat
      ) {
        event.preventDefault()
        setControlsOpen((open) => !open)
        return
      }

      if (
        event.code === 'KeyA' &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.repeat
      ) {
        event.preventDefault()
        setArchiveOpen((open) => !open)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const clearSaveFeedback = () => {
    if (saveFeedbackTimer.current !== null) {
      window.clearTimeout(saveFeedbackTimer.current)
      saveFeedbackTimer.current = null
    }
    setSaveStatus('idle')
  }

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
    authenticationRequiredRef.current = false
    setAuthenticationRequired(false)
    setCredentialRevision((revision) => revision + 1)
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

  const handleSeedChange = (nextSeed: P5Seed) => {
    setSettings((current) => ({ ...current, seed: nextSeed }))
    clearSaveFeedback()
    if (statusRef.current === 'connected') {
      void selectCode(nextSeed.id)
        .then((snapshot) => applyPresence(snapshot))
        .catch((error: unknown) => {
          if (!requirePairing(error)) {
            reportApplicationError(`Module selection failed: ${errorMessage(error)}`)
          }
          if (!(error instanceof ControlApiError)) {
            statusRef.current = 'offline'
            setControlStatus('offline')
          }
        })
    }
  }

  const handleGenesChange = (values: ArtworkGeneValues) => {
    setSettings((current) => ({
      ...current,
      genesBySeed: {
        ...current.genesBySeed,
        [current.seed.id]: { ...current.genesBySeed[current.seed.id], ...values },
      },
    }))
    clearSaveFeedback()
    if (statusRef.current === 'connected') {
      void updateApiGenes(values).catch((error: unknown) => {
        if (!requirePairing(error)) {
          reportApplicationError(`Gene update failed: ${errorMessage(error)}`)
        }
        if (!(error instanceof ControlApiError)) {
          statusRef.current = 'offline'
          setControlStatus('offline')
        }
      })
    }
  }

  const handleGeneChange = (id: string, value: number) => {
    handleGenesChange({ [id]: value })
  }

  const handleSaveImprint = async () => {
    clearSaveFeedback()
    setSaveStatus('saving')
    try {
      await createImprint()
      setSaveStatus('saved')
      saveFeedbackTimer.current = window.setTimeout(() => {
        setSaveStatus('idle')
        saveFeedbackTimer.current = null
      }, 1800)
      if (archiveOpen) void refreshImprints()
    } catch (error) {
      setSaveStatus('idle')
      if (!requirePairing(error)) {
        reportApplicationError(`Imprint save failed: ${errorMessage(error)}`)
      }
      if (!(error instanceof ControlApiError)) {
        statusRef.current = 'offline'
        setControlStatus('offline')
      }
    }
  }

  const handleDeleteImprint = async (imprint: ImprintRecord) => {
    if (activeImprintId === imprint.id) return
    const createdAt = new Date(imprint.createdAt)
    const label = Number.isNaN(createdAt.getTime()) ? imprint.createdAt : createdAt.toLocaleString()
    if (
      !window.confirm(
        `Delete the Imprint from ${label}? Its descendants will be kept and attached to its parent.`,
      )
    ) {
      return
    }

    try {
      await deleteImprint(imprint.id)
      setImprints((current) => current.filter((candidate) => candidate.id !== imprint.id))
    } catch (error) {
      if (!requirePairing(error)) {
        reportApplicationError(`Could not delete Imprint ${imprint.id}: ${errorMessage(error)}`)
      }
      if (!(error instanceof ControlApiError)) {
        statusRef.current = 'offline'
        setControlStatus('offline')
      }
    }
  }

  const handleSelectImprint = async (imprint: ImprintRecord) => {
    try {
      applyPresence(await selectImprint(imprint.id))
    } catch (error) {
      if (!requirePairing(error)) {
        reportApplicationError(`Could not select Imprint ${imprint.id}: ${errorMessage(error)}`)
      }
      if (!(error instanceof ControlApiError)) {
        statusRef.current = 'offline'
        setControlStatus('offline')
      }
    }
  }

  return (
    <main data-open-panels={controlsOpen && archiveOpen ? 'both' : 'one'}>
      <ArtworkCanvas
        key={seed.id}
        seed={seed}
        genes={geneValues}
        onFpsChange={import.meta.env.DEV ? setFps : undefined}
      />
      <DevelopmentOverlay fps={fps} />
      <RemoteAccessPairing
        required={authenticationRequired}
        pairingStatus={pairingStatus}
        onRequestPin={handleRequestPin}
        onSubmit={handlePair}
        onDismissPin={handleDismissPin}
      />
      <button
        type="button"
        className="controls-reveal"
        aria-label={controlsOpen ? 'Hide artwork controls' : 'Show artwork controls'}
        aria-controls="artwork-controls"
        aria-expanded={controlsOpen}
        title="Artwork controls (C)"
        onClick={() => setControlsOpen((open) => !open)}
      >
        <span className="controls-reveal-mark" aria-hidden="true" />
      </button>
      <button
        type="button"
        className="archive-reveal"
        aria-label={archiveOpen ? 'Hide Imprint archive' : 'Show Imprint archive'}
        aria-controls="imprint-archive"
        aria-expanded={archiveOpen}
        title="Imprint archive (A)"
        onClick={() => setArchiveOpen((open) => !open)}
      >
        <span className="controls-reveal-mark" aria-hidden="true" />
      </button>
      <SeedControls
        activeSeed={seed}
        seeds={artworkSeeds}
        onSeedChange={handleSeedChange}
        geneValues={geneValues}
        onGeneChange={handleGeneChange}
        onGenesChange={handleGenesChange}
        onSaveImprint={handleSaveImprint}
        controlStatus={controlStatus}
        saveStatus={saveStatus}
        controlsDisabled={controlStatus === 'connecting'}
        hidden={!controlsOpen}
      />
      <ImprintArchive
        imprints={imprints}
        activeImprintId={activeImprintId}
        connected={controlStatus === 'connected'}
        loading={archiveLoading}
        loadFailed={archiveLoadFailed}
        onSelect={handleSelectImprint}
        onDelete={handleDeleteImprint}
        hidden={!archiveOpen}
      />
    </main>
  )
}
