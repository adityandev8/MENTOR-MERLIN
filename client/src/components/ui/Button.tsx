import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';

type Variant = 'primary' | 'secondary' | 'quiet' | 'danger';
type Size = 'md' | 'sm';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  busy?: boolean;
  children: ReactNode;
}

export function Button({ variant = 'primary', size = 'md', busy = false, disabled, className = '', children, ...rest }: ButtonProps) {
  return (
    <button
      className={`btn btn-${variant} btn-${size} ${className}`}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {busy && <span className="spinner spinner-inline" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function ButtonLink({ variant = 'primary', size = 'md', className = '', ...rest }: LinkProps & { variant?: Variant; size?: Size }) {
  return <Link className={`btn btn-${variant} btn-${size} ${className}`} {...rest} />;
}
