import { useCallback, useEffect, useRef, useState } from 'react'
import { ArtworkCanvas } from './ArtworkCanvas'
import {
  ControlApiError,
  createImprint,
  deleteImprint,
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
import { reportApplicationError } from './errorNotifications'
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
  const [initialSettings] = useState(() => {
    const errors: string[] = []
    const settings = loadSettings(artworkSeeds, defaultArtworkSeed, (message) =>
      errors.push(message),
    )
    return { settings, errors }
  })
  const [settings, setSettings] = useState<ArtworkSettings>(initialSettings.settings)
  const [controlsOpen, setControlsOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [controlStatus, setControlStatus] = useState<ControlStatus>('connecting')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [imprints, setImprints] = useState<readonly ImprintRecord[]>([])
  const [activeImprintId, setActiveImprintId] = useState<string | null>(null)
  const [archiveLoading, setArchiveLoading] = useState(false)
  const [archiveLoadFailed, setArchiveLoadFailed] = useState(false)
  const settingsRef = useRef(settings)
  const statusRef = useRef(controlStatus)
  const revisionRef = useRef(-1)
  const saveFeedbackTimer = useRef<number | null>(null)
  const { seed } = settings
  const parameterValues = settings.parametersBySeed[seed.id]

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
    if (activeSeed === undefined || snapshot.module?.id !== activeSeed.id) {
      reportApplicationError(
        `Active module ${snapshot.code.id} is unavailable in this frontend build.`,
      )
      return
    }

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
      reportApplicationError(`Could not load Imprints: ${errorMessage(error)}`)
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
            () => setStatus('connected'),
            (error) => {
              setStatus('offline')
              reportApplicationError(error.message)
            },
          )
        }
      } catch (error) {
        if (!disposed) {
          setStatus('offline')
          reportApplicationError(`Control API unavailable: ${errorMessage(error)}`)
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

  const clearSaveFeedback = () => {
    if (saveFeedbackTimer.current !== null) {
      window.clearTimeout(saveFeedbackTimer.current)
      saveFeedbackTimer.current = null
    }
    setSaveStatus('idle')
  }

  const handleSeedChange = (nextSeed: ArtworkSeed) => {
    setSettings((current) => ({ ...current, seed: nextSeed }))
    clearSaveFeedback()
    if (statusRef.current === 'connected') {
      void selectCode(nextSeed.id)
        .then((snapshot) => applyPresence(snapshot))
        .catch((error: unknown) => {
          reportApplicationError(`Module selection failed: ${errorMessage(error)}`)
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
    clearSaveFeedback()
    if (statusRef.current === 'connected') {
      void updateApiParameters({ [id]: value }).catch((error: unknown) => {
        reportApplicationError(`Parameter update failed: ${errorMessage(error)}`)
        if (!(error instanceof ControlApiError)) {
          statusRef.current = 'offline'
          setControlStatus('offline')
        }
      })
    }
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
      reportApplicationError(`Imprint save failed: ${errorMessage(error)}`)
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
      reportApplicationError(`Could not delete Imprint ${imprint.id}: ${errorMessage(error)}`)
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
      reportApplicationError(`Could not select Imprint ${imprint.id}: ${errorMessage(error)}`)
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
