import type { ReactNode } from 'react';
import { ApiError } from '../../api/http';
import { Button } from './Button';

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <span className="spinner" role="status">
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="state state-loading">
      <Spinner label={label} />
      <p>{label}</p>
    </div>
  );
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong.';
}

export function ErrorState({ error, onRetry, title = 'This didn’t load' }: { error: unknown; onRetry?: () => void; title?: string }) {
  return (
    <div className="state state-error" role="alert">
      <h3>{title}</h3>
      <p>{errorMessage(error)}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="state state-empty">
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

type Tone = 'info' | 'success' | 'warning' | 'error';

export function Alert({ tone = 'info', title, children, onDismiss }: { tone?: Tone; title?: string; children?: ReactNode; onDismiss?: () => void }) {
  return (
    <div className={`alert alert-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <div>
        {title && <strong>{title}</strong>}
        {children && <div>{children}</div>}
      </div>
      {onDismiss && (
        <button className="alert-dismiss" onClick={onDismiss} aria-label="Dismiss">
          ×
        </button>
      )}
    </div>
  );
}
