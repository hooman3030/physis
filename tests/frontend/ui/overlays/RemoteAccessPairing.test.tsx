import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { RemoteAccessPairing } from '../../../../src/ui/overlays/RemoteAccessPairing'

describe('remote access pairing', () => {
  const props = {
    onRequestPin: vi.fn().mockResolvedValue(true),
    onSubmit: vi.fn().mockResolvedValue(true),
    onDismissPin: vi.fn().mockResolvedValue(undefined),
  }

  it('does not render when authentication is not required', () => {
    expect(
      renderToStaticMarkup(
        <RemoteAccessPairing required={false} pairingStatus={null} {...props} />,
      ),
    ).toBe('')
  })

  it('asks the phone to request a PIN instead of typing the installation token', () => {
    const markup = renderToStaticMarkup(
      <RemoteAccessPairing required pairingStatus={null} {...props} />,
    )

    expect(markup).toContain('Pair this browser')
    expect(markup).toContain('Request PIN')
    expect(markup).toContain('installation display')
    expect(markup).not.toContain('installation-token')
    expect(markup).not.toContain('type="password"')
  })

  it('shows the temporary PIN on the installation display only while pairing is pending', () => {
    const markup = renderToStaticMarkup(
      <RemoteAccessPairing
        required={false}
        pairingStatus={{ pin: '012345', expiresAt: 301_000 }}
        {...props}
      />,
    )

    expect(markup).toContain('Device pairing requested')
    expect(markup).toContain('012345')
    expect(markup).toContain('Cancel pairing')
  })
})
