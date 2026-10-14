type DevelopmentOverlayProps = {
  fps: number | null
}

export function DevelopmentOverlay({ fps }: DevelopmentOverlayProps) {
  if (!import.meta.env.DEV) return null

  return (
    <aside className="development-overlay" aria-label="Development diagnostics">
      <span aria-hidden="true">FPS</span>
      <output
        aria-label={fps === null ? 'Frame rate measuring' : `Frame rate ${fps} frames per second`}
      >
        {fps ?? '--'}
      </output>
    </aside>
  )
}
