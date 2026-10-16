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
  saveLineagePreview,
  saveControlApiToken,
  selectCode,
  selectImprint,
  setPresencePaused,
  setPresenceSpeed as updatePresenceSpeed,
  setPresenceAura,
  setPresenceToneMapping,
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
import { captureArtworkAnimation } from '../ui/archive/animationCapture'
import { DevelopmentOverlay } from '../ui/overlays/DevelopmentOverlay'
import { RemoteAccessPairing } from '../ui/overlays/RemoteAccessPairing'
import { ConfirmDialog } from '../ui/overlays/ConfirmDialog'
import { SeedControls } from '../ui/artwork/SeedControls'
import { PlaybackControls } from '../ui/artwork/PlaybackControls'
import { LineageRoute } from './LineageRoute'
import { removeDeletedImprintAndReparentChildren } from './imprintDeletion'
import { captureArtworkPreview } from '../ui/archive/previewCapture'
import { resolveAppRoute } from './routes'
import type { ArtworkGeneValues } from '../seeds/types'
import type { AuraId } from '../auras/types'
import type { ToneMappingId } from '../auras/toneMapping'
import { DEFAULT_PLAYBACK_SPEED } from '../playbackClock'
import { artworkSeeds, defaultArtworkSeed, type ArtworkSeed } from '../seeds/registry'
import '../ui/styles.css'

type ControlStatus = 'connecting' | 'connected' | 'offline'

const SAVE_WIPE_MINIMUM_MS = 650
const SAVE_FEEDBACK_DURATION_MS = 650

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function formatImprintDate(value: string): string {
  const timestamp = new Date(value)
  return Number.isNaN(timestamp.getTime()) ? value : timestamp.toLocaleString()
}

export function App() {
  const route = resolveAppRoute(window.location.pathname)
  if (route === 'lineage') return <LineageRoute />
  if (route === 'not-found') {
    return (
      <main className="application-error-fallback">
        <p>Page not found.</p>
        <a href="/">Return to the artwork</a>
      </main>
    )
  }
  return <ArtworkApp />
}

function ArtworkApp() {
  const [initialSettings] = useState(() => {
    const errors: string[] = []
    const settings = loadSettings(artworkSeeds, defaultArtworkSeed, (message) =>
      errors.push(message),
    )
    return { settings, errors }
  })
  const [settings, setSettings] = useState<ArtworkSettings<ArtworkSeed>>(initialSettings.settings)
  const [controlsOpen, setControlsOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [canvasResetVersion, setCanvasResetVersion] = useState(0)
  const [controlStatus, setControlStatus] = useState<ControlStatus>('connecting')
  const [paused, setPaused] = useState(false)
  const [speed, setSpeed] = useState(DEFAULT_PLAYBACK_SPEED)
  const [auraId, setAuraId] = useState<AuraId | null>(
    initialSettings.settings.seed.runtime === 'three'
      ? (initialSettings.settings.seed.defaultAuraId ?? 'off')
      : null,
  )
  const [toneMappingId, setToneMappingId] = useState<ToneMappingId | null>(
    initialSettings.settings.seed.runtime === 'three' ? 'none' : null,
  )
  const [playbackUpdating, setPlaybackUpdating] = useState(false)
  const [fps, setFps] = useState<number | null>(null)
  const [authenticationRequired, setAuthenticationRequired] = useState(false)
  const [pairingStatus, setPairingStatus] = useState<PairingStatus | null>(null)
  const [credentialRevision, setCredentialRevision] = useState(0)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [imprints, setImprints] = useState<readonly ImprintRecord[]>([])
  const [activeImprintId, setActiveImprintId] = useState<string | null>(null)
  const [pendingImprintDeletion, setPendingImprintDeletion] = useState<ImprintRecord | null>(null)
  const [archiveLoading, setArchiveLoading] = useState(false)
  const [archiveLoadFailed, setArchiveLoadFailed] = useState(false)
  const [canvasRevision, setCanvasRevision] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const settingsRef = useRef(settings)
  const statusRef = useRef(controlStatus)
  const authenticationRequiredRef = useRef(false)
  const pairingStatusFailureRef = useRef(false)
  const revisionRef = useRef(-1)
  const saveFeedbackTimer = useRef<number | null>(null)
  const playbackSpeedTimer = useRef<number | null>(null)
  const playbackSpeedSequence = useRef(0)
  const pendingSpeedRef = useRef<number | null>(null)
  const authoritativeSpeedRef = useRef(DEFAULT_PLAYBACK_SPEED)
  const { seed } = settings
  const geneValues = settings.genesBySeed[seed.id]
  const handleCanvasReady = useCallback((canvas: HTMLCanvasElement | null) => {
    canvasRef.current = canvas
    if (canvas !== null) setCanvasRevision((revision) => revision + 1)
  }, [])

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
      if (playbackSpeedTimer.current !== null) {
        window.clearTimeout(playbackSpeedTimer.current)
      }
      playbackSpeedSequence.current += 1
      pendingSpeedRef.current = null
    },
    [],
  )

  const applyPresence = useCallback((snapshot: PresenceSnapshot, force = false) => {
    if (!force && snapshot.revision < revisionRef.current) return
    revisionRef.current = snapshot.revision
    setPaused(snapshot.paused)
    authoritativeSpeedRef.current = snapshot.speed
    if (pendingSpeedRef.current === null) setSpeed(snapshot.speed)
    setAuraId(snapshot.auraId)
    setToneMappingId(snapshot.toneMappingId)
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
    if (controlStatus !== 'connected' || canvasRevision === 0) return

    let cancelled = false
    const timer = window.setTimeout(() => {
      const canvas = canvasRef.current
      if (canvas === null) return
      void captureArtworkPreview(canvas)
        .then(async (preview) => {
          if (!cancelled && preview !== null) {
            await saveLineagePreview('code', seed.id, preview)
          }
        })
        .catch((error: unknown) => {
          if (!cancelled && !requirePairing(error)) {
            reportApplicationError(`Could not save the Seed preview: ${errorMessage(error)}`)
          }
        })
      void captureArtworkAnimation(canvas)
        .then(async (animation) => {
          if (!cancelled && animation !== null) {
            await saveLineagePreview('code', seed.id, animation, 'animation')
          }
        })
        .catch((error: unknown) => {
          if (!cancelled && !requirePairing(error)) {
            reportApplicationError(`Could not save the Seed animation: ${errorMessage(error)}`)
          }
        })
    }, 900)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [canvasRevision, controlStatus, requirePairing, seed.id])

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
        event.code === 'KeyR' &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.repeat
      ) {
        event.preventDefault()
        setCanvasResetVersion((version) => version + 1)
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

  const handleSeedChange = (nextSeed: ArtworkSeed) => {
    setSettings((current) => ({ ...current, seed: nextSeed }))
    setAuraId(nextSeed.runtime === 'three' ? (nextSeed.defaultAuraId ?? 'off') : null)
    setToneMappingId(nextSeed.runtime === 'three' ? 'none' : null)
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

  const handleAuraChange = (nextAuraId: AuraId) => {
    if (statusRef.current !== 'connected') return
    void setPresenceAura(nextAuraId)
      .then((snapshot) => applyPresence(snapshot))
      .catch((error: unknown) => {
        if (!requirePairing(error)) {
          reportApplicationError(`Aura selection failed: ${errorMessage(error)}`)
        }
        if (!(error instanceof ControlApiError)) {
          statusRef.current = 'offline'
          setControlStatus('offline')
        }
      })
  }

  const handleToneMappingChange = (nextToneMappingId: ToneMappingId) => {
    if (statusRef.current !== 'connected') return
    void setPresenceToneMapping(nextToneMappingId)
      .then((snapshot) => applyPresence(snapshot))
      .catch((error: unknown) => {
        if (!requirePairing(error)) {
          reportApplicationError(`Tone mapping selection failed: ${errorMessage(error)}`)
        }
        if (!(error instanceof ControlApiError)) {
          statusRef.current = 'offline'
          setControlStatus('offline')
        }
      })
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

  const handlePlaybackToggle = async () => {
    if (statusRef.current !== 'connected' || playbackUpdating) return
    setPlaybackUpdating(true)
    try {
      applyPresence(await setPresencePaused(!paused))
    } catch (error) {
      if (!requirePairing(error)) {
        reportApplicationError(`Could not change artwork playback: ${errorMessage(error)}`)
      }
      if (!(error instanceof ControlApiError)) {
        statusRef.current = 'offline'
        setControlStatus('offline')
      }
    } finally {
      setPlaybackUpdating(false)
    }
  }

  const handlePlaybackSpeedChange = (nextSpeed: number) => {
    if (statusRef.current !== 'connected') return
    setSpeed(nextSpeed)
    pendingSpeedRef.current = nextSpeed
    const sequence = ++playbackSpeedSequence.current
    if (playbackSpeedTimer.current !== null) {
      window.clearTimeout(playbackSpeedTimer.current)
    }
    playbackSpeedTimer.current = window.setTimeout(() => {
      playbackSpeedTimer.current = null
      if (statusRef.current !== 'connected') {
        if (sequence === playbackSpeedSequence.current) {
          pendingSpeedRef.current = null
          setSpeed(authoritativeSpeedRef.current)
        }
        return
      }
      void updatePresenceSpeed(nextSpeed)
        .then((snapshot) => {
          if (sequence === playbackSpeedSequence.current) {
            pendingSpeedRef.current = null
            applyPresence(snapshot)
          }
        })
        .catch((error: unknown) => {
          if (sequence === playbackSpeedSequence.current) {
            pendingSpeedRef.current = null
            setSpeed(authoritativeSpeedRef.current)
          }
          if (!requirePairing(error)) {
            reportApplicationError(`Could not change artwork speed: ${errorMessage(error)}`)
          }
          if (!(error instanceof ControlApiError)) {
            statusRef.current = 'offline'
            setControlStatus('offline')
          }
        })
    }, 120)
  }

  const handleGeneChange = (id: string, value: number) => {
    handleGenesChange({ [id]: value })
  }

  const handleSaveImprint = async () => {
    clearSaveFeedback()
    const saveStartedAt = performance.now()
    setSaveStatus('saving')
    const animationPromise = captureArtworkAnimation(canvasRef.current).catch((error: unknown) => {
      reportApplicationError(`Could not capture the Imprint animation: ${errorMessage(error)}`)
      return null
    })
    const previewPromise = captureArtworkPreview(canvasRef.current).catch((error: unknown) => {
      reportApplicationError(`Could not capture the Imprint preview: ${errorMessage(error)}`)
      return null
    })
    try {
      const imprint = await createImprint()
      void previewPromise
        .then(async (preview) => {
          if (preview !== null) await saveLineagePreview('imprint', imprint.id, preview)
        })
        .catch((error: unknown) => {
          if (!requirePairing(error)) {
            reportApplicationError(`Could not save the Imprint preview: ${errorMessage(error)}`)
          }
        })
      void animationPromise
        .then(async (animation) => {
          if (animation !== null) {
            await saveLineagePreview('imprint', imprint.id, animation, 'animation')
          }
        })
        .catch((error: unknown) => {
          if (!requirePairing(error)) {
            reportApplicationError(`Could not save the Imprint animation: ${errorMessage(error)}`)
          }
        })
      const remainingWipeDuration = SAVE_WIPE_MINIMUM_MS - (performance.now() - saveStartedAt)
      if (remainingWipeDuration > 0) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, remainingWipeDuration))
      }
      setSaveStatus('saved')
      saveFeedbackTimer.current = window.setTimeout(() => {
        setSaveStatus('idle')
        saveFeedbackTimer.current = null
      }, SAVE_FEEDBACK_DURATION_MS)
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

  const handleDeleteImprint = (imprint: ImprintRecord) => {
    if (activeImprintId === imprint.id) return
    setPendingImprintDeletion(imprint)
  }

  const confirmDeleteImprint = async () => {
    const imprint = pendingImprintDeletion
    if (imprint === null) return
    if (activeImprintId === imprint.id) {
      setPendingImprintDeletion(null)
      reportApplicationError('Select another Imprint before deleting the active one.')
      return
    }

    try {
      await deleteImprint(imprint.id)
      setImprints((current) => removeDeletedImprintAndReparentChildren(current, imprint.id))
    } catch (error) {
      if (!requirePairing(error)) {
        reportApplicationError(`Could not delete Imprint ${imprint.id}: ${errorMessage(error)}`)
      }
      if (!(error instanceof ControlApiError)) {
        statusRef.current = 'offline'
        setControlStatus('offline')
      }
    } finally {
      setPendingImprintDeletion(null)
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
        key={`${seed.id}-${canvasResetVersion}`}
        seed={seed}
        genes={geneValues}
        paused={paused}
        speed={speed}
        auraId={auraId}
        toneMappingId={toneMappingId}
        onFpsChange={import.meta.env.DEV ? setFps : undefined}
        onCanvasReady={handleCanvasReady}
      />
      <DevelopmentOverlay fps={fps} />
      <PlaybackControls
        paused={paused}
        onPlaybackToggle={handlePlaybackToggle}
        playbackUpdating={playbackUpdating}
        speed={speed}
        onPlaybackSpeedChange={handlePlaybackSpeedChange}
        controlStatus={controlStatus}
      />
      <RemoteAccessPairing
        required={authenticationRequired}
        pairingStatus={pairingStatus}
        onRequestPin={handleRequestPin}
        onSubmit={handlePair}
        onDismissPin={handleDismissPin}
      />
      <button
        type="button"
        className="surface-reveal surface-reveal--right"
        aria-label={controlsOpen ? 'Hide artwork controls' : 'Show artwork controls'}
        aria-controls="artwork-controls"
        aria-expanded={controlsOpen}
        title="Artwork controls (C)"
        onClick={() => setControlsOpen((open) => !open)}
      >
        <span className="surface-reveal-mark" aria-hidden="true" />
      </button>
      <button
        type="button"
        className="surface-reveal surface-reveal--left"
        aria-label={archiveOpen ? 'Hide Imprint archive' : 'Show Imprint archive'}
        aria-controls="imprint-archive"
        aria-expanded={archiveOpen}
        title="Imprint archive (A)"
        onClick={() => setArchiveOpen((open) => !open)}
      >
        <span className="surface-reveal-mark" aria-hidden="true" />
      </button>
      <SeedControls
        activeSeed={seed}
        seeds={artworkSeeds}
        onSeedChange={handleSeedChange}
        auraId={auraId}
        onAuraChange={handleAuraChange}
        toneMappingId={toneMappingId}
        onToneMappingChange={handleToneMappingChange}
        geneValues={geneValues}
        onGeneChange={handleGeneChange}
        onGenesChange={handleGenesChange}
        onResetCanvas={() => setCanvasResetVersion((version) => version + 1)}
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
      {pendingImprintDeletion !== null && (
        <ConfirmDialog
          title="Delete this Imprint?"
          description={`Delete the Imprint from ${formatImprintDate(pendingImprintDeletion.createdAt)}? Its descendants will be kept and attached to its parent.`}
          confirmLabel="Delete Imprint"
          onConfirm={confirmDeleteImprint}
          onCancel={() => setPendingImprintDeletion(null)}
        />
      )}
    </main>
  )
}
