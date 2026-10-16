import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'md' | 'lg'

const base =
  'inline-flex items-center justify-center gap-2 rounded-panel font-semibold transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60'

const variants: Record<Variant, string> = {
  primary: 'bg-forest-700 text-white hover:bg-forest-600 shadow-card',
  secondary: 'border border-forest-700 bg-white text-forest-800 hover:bg-forest-50',
  ghost: 'text-forest-800 hover:bg-forest-50',
  danger: 'border border-alert-500 bg-white text-alert-700 hover:bg-alert-50',
}

/** 触控目标不小于 44px（senior-friendly）。 */
const sizes: Record<Size, string> = {
  md: 'min-h-11 px-4 py-2.5 text-[1rem]',
  lg: 'min-h-13 px-6 py-3.5 text-[1.0625rem]',
}

interface CommonProps {
  variant?: Variant
  size?: Size
  fullWidth?: boolean
  className?: string
  children: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth,
  className,
  children,
  ...rest
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className)}
    >
      {children}
    </button>
  )
}

export function ButtonLink({
  to,
  variant = 'primary',
  size = 'md',
  fullWidth,
  className,
  children,
  ariaLabel,
}: CommonProps & { to: string; ariaLabel?: string }) {
  return (
    <Link
      to={to}
      aria-label={ariaLabel}
      className={cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className)}
    >
      {children}
    </Link>
  )
}
