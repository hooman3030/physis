import { useCallback, useEffect, useRef, useState } from 'react'
import { ArtworkCanvas } from './ArtworkCanvas'
import {
  ControlApiError,
  createImprint,
  getPresence,
  listImprints,
  selectCode,
  selectImprint,
  setParameters as updateApiParameters,
  subscribeToPresence,
  type ImprintRecord,
  type PresenceSnapshot,
} from './controlClient'
import {
  loadSettings,
  sanitizeParameterValues,
  saveSettings,
  type ArtworkSettings,
} from './persistence'
import { ImprintArchive } from './ImprintArchive'
import { SeedControls } from './SeedControls'
import { artworkSeeds, defaultArtworkSeed } from './seeds/registry'
import type { ArtworkSeed } from './seeds/types'
import './styles.css'

type ControlStatus = 'connecting' | 'connected' | 'offline'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function App() {
  const [settings, setSettings] = useState<ArtworkSettings>(() =>
    loadSettings(artworkSeeds, defaultArtworkSeed),
  )
  const [controlsOpen, setControlsOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [controlStatus, setControlStatus] = useState<ControlStatus>('connecting')
  const [controlError, setControlError] = useState<string | null>(null)
  const [operationMessage, setOperationMessage] = useState<string | null>(null)
  const [imprints, setImprints] = useState<readonly ImprintRecord[]>([])
  const [activeImprintId, setActiveImprintId] = useState<string | null>(null)
  const [archiveLoading, setArchiveLoading] = useState(false)
  const [archiveError, setArchiveError] = useState<string | null>(null)
  const settingsRef = useRef(settings)
  const statusRef = useRef(controlStatus)
  const revisionRef = useRef(-1)
  const { seed } = settings
  const parameterValues = settings.parametersBySeed[seed.id]

  settingsRef.current = settings
  statusRef.current = controlStatus

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  const applyPresence = useCallback((snapshot: PresenceSnapshot, force = false) => {
    if (!force && snapshot.revision < revisionRef.current) return
    revisionRef.current = snapshot.revision
    setActiveImprintId(snapshot.imprint?.id ?? null)

    if (snapshot.code === null) return
    const activeSeed = artworkSeeds.find((candidate) => candidate.id === snapshot.code?.id)
    if (activeSeed === undefined || snapshot.module?.id !== activeSeed.id) {
      setControlError(`Active module ${snapshot.code.id} is unavailable in this frontend build.`)
      return
    }

    setControlError(null)
    setSettings((current) => ({
      ...current,
      seed: activeSeed,
      parametersBySeed: {
        ...current.parametersBySeed,
        [activeSeed.id]: sanitizeParameterValues(activeSeed, snapshot.parameters),
      },
    }))
  }, [])

  const refreshImprints = useCallback(async () => {
    if (statusRef.current !== 'connected') {
      setArchiveError('The local control API is unavailable.')
      return
    }

    setArchiveLoading(true)
    setArchiveError(null)
    try {
      const records = await listImprints()
      setImprints([...records].sort((left, right) => right.createdAt.localeCompare(left.createdAt)))
    } catch (error) {
      setArchiveError(`Could not load Imprints: ${errorMessage(error)}`)
      if (!(error instanceof ControlApiError)) {
        statusRef.current = 'offline'
        setControlStatus('offline')
      }
    } finally {
      setArchiveLoading(false)
    }
  }, [])

  useEffect(() => {
    if (archiveOpen && controlStatus === 'connected') void refreshImprints()
  }, [archiveOpen, controlStatus, refreshImprints])

  useEffect(() => {
    let disposed = false
    let connecting = false
    let closeEvents: (() => void) | null = null

    const setStatus = (status: ControlStatus) => {
      statusRef.current = status
      setControlStatus(status)
    }

    const connect = async (initial: boolean) => {
      if (disposed || connecting || statusRef.current === 'connected') return
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
              setStatus('connected')
              setControlError(null)
            },
            (error) => {
              setStatus('offline')
              setControlError(error.message)
            },
          )
        }
      } catch (error) {
        if (!disposed) {
          setStatus('offline')
          setControlError(`Control API unavailable: ${errorMessage(error)}`)
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
  }, [applyPresence])

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

  const handleSeedChange = (nextSeed: ArtworkSeed) => {
    setSettings((current) => ({ ...current, seed: nextSeed }))
    setOperationMessage(null)
    if (statusRef.current === 'connected') {
      void selectCode(nextSeed.id)
        .then((snapshot) => applyPresence(snapshot))
        .catch((error: unknown) => {
          setControlError(`Module selection failed: ${errorMessage(error)}`)
          if (!(error instanceof ControlApiError)) {
            statusRef.current = 'offline'
            setControlStatus('offline')
          }
        })
    }
  }

  const handleParameterChange = (id: string, value: number) => {
    setSettings((current) => ({
      ...current,
      parametersBySeed: {
        ...current.parametersBySeed,
        [current.seed.id]: { ...current.parametersBySeed[current.seed.id], [id]: value },
      },
    }))
    setOperationMessage(null)
    if (statusRef.current === 'connected') {
      void updateApiParameters({ [id]: value }).catch((error: unknown) => {
        setControlError(`Parameter update failed: ${errorMessage(error)}`)
        if (!(error instanceof ControlApiError)) {
          statusRef.current = 'offline'
          setControlStatus('offline')
        }
      })
    }
  }

  const handleSaveImprint = async () => {
    setOperationMessage(null)
    setControlError(null)
    try {
      const imprint = await createImprint()
      setOperationMessage(`Saved Imprint ${imprint.id}`)
      if (archiveOpen) void refreshImprints()
    } catch (error) {
      setControlError(`Imprint save failed: ${errorMessage(error)}`)
      if (!(error instanceof ControlApiError)) {
        statusRef.current = 'offline'
        setControlStatus('offline')
      }
    }
  }

  const handleSelectImprint = async (imprint: ImprintRecord) => {
    setArchiveError(null)
    try {
      applyPresence(await selectImprint(imprint.id))
    } catch (error) {
      setArchiveError(`Could not select Imprint ${imprint.id}: ${errorMessage(error)}`)
      if (!(error instanceof ControlApiError)) {
        statusRef.current = 'offline'
        setControlStatus('offline')
      }
    }
  }

  return (
    <main data-open-panels={controlsOpen && archiveOpen ? 'both' : 'one'}>
      <ArtworkCanvas key={seed.id} seed={seed} parameters={parameterValues} />
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
        parameterValues={parameterValues}
        onParameterChange={handleParameterChange}
        onSaveImprint={handleSaveImprint}
        controlStatus={controlStatus}
        controlError={controlError}
        operationMessage={operationMessage}
        controlsDisabled={controlStatus === 'connecting'}
        hidden={!controlsOpen}
      />
      <ImprintArchive
        imprints={imprints}
        activeImprintId={activeImprintId}
        connected={controlStatus === 'connected'}
        loading={archiveLoading}
        error={archiveError}
        onRefresh={() => void refreshImprints()}
        onSelect={handleSelectImprint}
        hidden={!archiveOpen}
      />
    </main>
  )
}
