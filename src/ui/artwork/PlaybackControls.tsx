import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { DEFAULT_PLAYBACK_SPEED, MAX_PLAYBACK_SPEED, MIN_PLAYBACK_SPEED } from '../../playbackClock'
import { useSurfaceTransition } from '../primitives/useSurfaceTransition'

const SPEED_STEP = 0.1
const SPEED_STEP_COUNT = Math.round((MAX_PLAYBACK_SPEED - MIN_PLAYBACK_SPEED) / SPEED_STEP)
type PlaybackProgressStyle = CSSProperties & { '--playback-progress': number }

export function getPlaybackSpeedFromDialAngle(angle: number): number | null {
  if (!Number.isFinite(angle)) return null

  const normalizedAngle = ((angle % 360) + 360) % 360
  if (normalizedAngle > 45 && normalizedAngle < 135) return null

  const progress = Math.min(1, ((normalizedAngle - 135 + 360) % 360) / 270)
  const step = Math.round(progress * SPEED_STEP_COUNT)
  return Number((MIN_PLAYBACK_SPEED + step * SPEED_STEP).toFixed(1))
}

type PlaybackControlsProps = {
  paused: boolean
  onPlaybackToggle: () => void
  playbackUpdating: boolean
  speed: number
  onPlaybackSpeedChange: (speed: number) => void
  controlStatus: 'connecting' | 'connected' | 'offline'
}

export function PlaybackControls({
  paused,
  onPlaybackToggle,
  playbackUpdating,
  speed,
  onPlaybackSpeedChange,
  controlStatus,
}: PlaybackControlsProps) {
  const [open, setOpen] = useState(false)
  const surfaceTransition = useSurfaceTransition(open)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const pointerActive = useRef(false)
  const controlsDisabled = controlStatus !== 'connected'
  const progress = Math.min(
    1,
    Math.max(0, (speed - MIN_PLAYBACK_SPEED) / (MAX_PLAYBACK_SPEED - MIN_PLAYBACK_SPEED)),
  )
  const progressStyle: PlaybackProgressStyle = { '--playback-progress': progress * 75 }
  const activeTick = Math.round(progress * SPEED_STEP_COUNT)
  const speedDisabled = controlsDisabled

  function setSpeedBySteps(steps: number): void {
    const currentStep = Math.round((speed - MIN_PLAYBACK_SPEED) / SPEED_STEP)
    const nextStep = Math.min(SPEED_STEP_COUNT, Math.max(0, currentStep + steps))
    onPlaybackSpeedChange(Number((MIN_PLAYBACK_SPEED + nextStep * SPEED_STEP).toFixed(1)))
  }

  function updateSpeedFromPointer(event: PointerEvent<HTMLDivElement>): void {
    const bounds = event.currentTarget.getBoundingClientRect()
    const offsetX = event.clientX - (bounds.left + bounds.width / 2)
    const offsetY = event.clientY - (bounds.top + bounds.height / 2)
    if (Math.hypot(offsetX, offsetY) < Math.min(bounds.width, bounds.height) * 0.2) return

    const angle = (Math.atan2(offsetY, offsetX) * 180) / Math.PI
    const nextSpeed = getPlaybackSpeedFromDialAngle(angle)
    if (nextSpeed !== null) onPlaybackSpeedChange(nextSpeed)
  }

  function handleDialKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (speedDisabled) return
    if (event.key === 'Home') {
      event.preventDefault()
      onPlaybackSpeedChange(MIN_PLAYBACK_SPEED)
    } else if (event.key === 'End') {
      event.preventDefault()
      onPlaybackSpeedChange(MAX_PLAYBACK_SPEED)
    } else if (event.key === 'PageUp') {
      event.preventDefault()
      setSpeedBySteps(5)
    } else if (event.key === 'PageDown') {
      event.preventDefault()
      setSpeedBySteps(-5)
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
      event.preventDefault()
      setSpeedBySteps(1)
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
      event.preventDefault()
      setSpeedBySteps(-1)
    }
  }

  function handleSurfaceKeyDown(event: KeyboardEvent<HTMLElement>): void {
    if (event.key !== 'Escape') return
    event.preventDefault()
    setOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="surface-reveal surface-reveal--bottom"
        aria-label={open ? 'Hide playback controls' : 'Show playback controls'}
        aria-controls="playback-controls-surface"
        aria-expanded={open}
        title="Global playback controls"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="surface-reveal-mark" aria-hidden="true" />
      </button>
      <section
        id="playback-controls-surface"
        className="playback-surface"
        aria-label="Playback controls"
        aria-hidden={surfaceTransition.ariaHidden}
        hidden={surfaceTransition.hidden}
        inert={surfaceTransition.inert}
        onKeyDown={handleSurfaceKeyDown}
      >
        <div
          className={`playback-dial-shell surface ${surfaceTransition.className}`}
          onAnimationEnd={surfaceTransition.onAnimationEnd}
        >
          <button
            type="button"
            className="playback-toggle"
            aria-label={paused ? 'Resume artwork' : 'Pause artwork'}
            aria-busy={playbackUpdating}
            aria-pressed={paused}
            disabled={controlsDisabled}
            onClick={onPlaybackToggle}
          >
            <svg
              className={`playback-toggle-icon playback-toggle-icon--play${paused ? ' is-active' : ''}`}
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M8 4.75v14.5L19 12 8 4.75Z" />
            </svg>
            <svg
              className={`playback-toggle-icon playback-toggle-icon--pause${paused ? '' : ' is-active'}`}
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
            >
              <rect x="6.5" y="5" width="4" height="14" rx="1" />
              <rect x="13.5" y="5" width="4" height="14" rx="1" />
            </svg>
          </button>
          <div
            id="playback-speed-dial"
            className="playback-dial"
            role="slider"
            aria-label="Playback speed, double-click to reset to 1×"
            aria-valuemin={MIN_PLAYBACK_SPEED}
            aria-valuemax={MAX_PLAYBACK_SPEED}
            aria-valuenow={speed}
            aria-valuetext={`${speed.toFixed(1)} times`}
            aria-disabled={speedDisabled}
            tabIndex={speedDisabled ? -1 : 0}
            onKeyDown={handleDialKeyDown}
            onDoubleClick={() => {
              if (!speedDisabled) onPlaybackSpeedChange(DEFAULT_PLAYBACK_SPEED)
            }}
            onPointerDown={(event) => {
              if (speedDisabled || event.button !== 0) return
              event.preventDefault()
              pointerActive.current = true
              event.currentTarget.setPointerCapture(event.pointerId)
              updateSpeedFromPointer(event)
            }}
            onPointerMove={(event) => {
              if (pointerActive.current && !speedDisabled) updateSpeedFromPointer(event)
            }}
            onPointerUp={() => {
              pointerActive.current = false
            }}
            onPointerCancel={() => {
              pointerActive.current = false
            }}
            onLostPointerCapture={() => {
              pointerActive.current = false
            }}
          >
            <svg viewBox="0 0 160 160" aria-hidden="true" focusable="false">
              <circle
                className="playback-dial-track"
                cx="80"
                cy="80"
                r="66"
                pathLength="100"
                strokeDasharray="75 25"
                transform="rotate(135 80 80)"
              />
              <circle
                className="playback-dial-progress"
                cx="80"
                cy="80"
                r="66"
                pathLength="100"
                strokeDasharray={`${progress * 75} 100`}
                style={progressStyle}
                transform="rotate(135 80 80)"
              />
              {Array.from({ length: SPEED_STEP_COUNT + 1 }, (_, index) => (
                <line
                  key={index}
                  className={`playback-dial-tick${index <= activeTick ? ' is-active' : ''}${index % 5 === 0 ? ' is-major' : ''}`}
                  x1="80"
                  y1="5"
                  x2="80"
                  y2={index % 5 === 0 ? '14' : '10'}
                  style={
                    index <= activeTick
                      ? { animationDelay: `${activeTick > 0 ? (index / activeTick) * 280 : 0}ms` }
                      : undefined
                  }
                  transform={`rotate(${225 + (index / SPEED_STEP_COUNT) * 270} 80 80)`}
                />
              ))}
            </svg>
            <span className="playback-dial-value" aria-hidden="true">
              {speed.toFixed(1)}
              <small>×</small>
            </span>
          </div>
        </div>
      </section>
    </>
  )
}
