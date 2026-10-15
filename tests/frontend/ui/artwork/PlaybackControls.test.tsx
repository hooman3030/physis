import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import {
  getPlaybackSpeedFromDialAngle,
  PlaybackControls,
} from '../../../../src/ui/artwork/PlaybackControls'

describe('playback controls', () => {
  it('opens from its bottom trigger and exposes an accessible speed dial and icon toggle', () => {
    const markup = renderToStaticMarkup(
      <PlaybackControls
        paused={false}
        onPlaybackToggle={vi.fn()}
        playbackUpdating={false}
        speed={1}
        onPlaybackSpeedChange={vi.fn()}
        controlStatus="connected"
      />,
    )

    expect(markup).toContain('aria-label="Show playback controls"')
    expect(markup).toContain('aria-controls="playback-controls-surface"')
    expect(markup).toContain('aria-expanded="false"')
    expect(markup).toContain('id="playback-controls-surface"')
    expect(markup).toContain('hidden=""')
    expect(markup).toContain('role="slider"')
    expect(markup).toContain('class="playback-dial-shell surface"')
    expect(markup).toContain('aria-label="Playback speed, double-click to reset to 1×"')
    expect(markup).toContain('aria-valuetext="1.0 times"')
    expect(markup).toContain('aria-label="Pause artwork"')
    expect(markup).toContain('playback-toggle-icon--pause is-active')
    expect(markup).not.toContain('playback-toggle-icon--play is-active')
    expect(markup).not.toContain('type="range"')
    expect(markup).not.toContain('global clock')
    expect(markup).not.toContain('LINKED')
    expect(markup).not.toContain('0.1—4×')
    expect(markup).not.toContain('>Playback speed</span>')
    expect(markup).not.toContain('SPEED</span>')
    expect(markup).not.toContain('Artwork is running.')
    expect(markup).not.toContain('>PAUSE</span>')
    expect(markup).toContain('transform="rotate(135 80 80)"')
    expect(markup).toContain('transform="rotate(225 80 80)"')
    expect(markup).toContain('transform="rotate(495 80 80)"')
    expect(markup.indexOf('class="playback-toggle"')).toBeLessThan(
      markup.indexOf('id="playback-speed-dial"'),
    )

    const triggerStart = markup.indexOf('class="surface-reveal surface-reveal--bottom"')
    const triggerEnd = markup.indexOf('</button>', triggerStart)
    const triggerMarkup = markup.slice(triggerStart, triggerEnd)
    expect(triggerMarkup).toContain('class="surface-reveal-mark"')
    expect(triggerMarkup).not.toContain('PLAYBACK')
  })

  it('shows paused and disconnected state while disabling playback changes', () => {
    const markup = renderToStaticMarkup(
      <PlaybackControls
        paused
        onPlaybackToggle={vi.fn()}
        playbackUpdating={false}
        speed={0.5}
        onPlaybackSpeedChange={vi.fn()}
        controlStatus="offline"
      />,
    )

    expect(markup).toContain('aria-label="Resume artwork"')
    expect(markup).toContain('aria-pressed="true"')
    expect(markup).toContain('playback-toggle-icon--play is-active')
    expect(markup).not.toContain('playback-toggle-icon--pause is-active')
    expect(markup).toContain('aria-disabled="true"')
    expect(markup).toContain('0.5')
    expect(markup).toContain('disabled=""')
  })

  it('keeps the playback button enabled and named during playback updates', () => {
    const markup = renderToStaticMarkup(
      <PlaybackControls
        paused={false}
        onPlaybackToggle={vi.fn()}
        playbackUpdating
        speed={1}
        onPlaybackSpeedChange={vi.fn()}
        controlStatus="connected"
      />,
    )

    expect(markup).toContain('aria-label="Pause artwork"')
    expect(markup).toContain('aria-busy="true"')
    expect(markup).not.toContain('disabled=""')
  })

  it.each([
    [135, 0.1],
    [180, 0.8],
    [225, 1.4],
    [315, 2.7],
    [45, 4],
    [90, null],
    [Number.NaN, null],
  ])('maps dial angle %s to speed %s', (angle, speed) => {
    expect(getPlaybackSpeedFromDialAngle(angle)).toBe(speed)
  })
})
