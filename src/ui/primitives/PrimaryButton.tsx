import { useState, type ButtonHTMLAttributes, type MouseEventHandler } from 'react'

type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  animateOnClick?: boolean
}

export function PrimaryButton({
  animateOnClick = true,
  children,
  className,
  onClick,
  ...buttonProps
}: PrimaryButtonProps) {
  const [animationKey, setAnimationKey] = useState(0)
  const handleClick: MouseEventHandler<HTMLButtonElement> = (event) => {
    if (animateOnClick) setAnimationKey((key) => key + 1)
    onClick?.(event)
  }

  return (
    <button
      {...buttonProps}
      className={['button--primary', className].filter(Boolean).join(' ')}
      onClick={handleClick}
    >
      {animateOnClick && (
        <span
          key={animationKey}
          className={`primary-button__fill${animationKey > 0 ? ' primary-button__fill--animating' : ''}`}
          aria-hidden="true"
        />
      )}
      <span className="primary-button__content">{children}</span>
    </button>
  )
}
