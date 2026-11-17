import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

interface FieldShellProps {
  label: string;
  error?: string;
  hint?: string;
  children: (id: string, describedBy: string | undefined) => ReactNode;
}

function FieldShell({ label, error, hint, children }: FieldShellProps) {
  const id = useId();
  const msgId = `${id}-msg`;
  return (
    <div className={`field ${error ? 'field-invalid' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children(id, error || hint ? msgId : undefined)}
      {error ? (
        <p id={msgId} className="field-error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={msgId} className="field-hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type Common = { label: string; error?: string; hint?: string };

export function TextField({ label, error, hint, ...rest }: Common & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <FieldShell label={label} error={error} hint={hint}>
      {(id, describedBy) => <input id={id} aria-invalid={!!error || undefined} aria-describedby={describedBy} {...rest} />}
    </FieldShell>
  );
}

export function TextArea({ label, error, hint, ...rest }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <FieldShell label={label} error={error} hint={hint}>
      {(id, describedBy) => <textarea id={id} aria-invalid={!!error || undefined} aria-describedby={describedBy} {...rest} />}
    </FieldShell>
  );
}

export function SelectField({ label, error, hint, children, ...rest }: Common & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <FieldShell label={label} error={error} hint={hint}>
      {(id, describedBy) => (
        <select id={id} aria-invalid={!!error || undefined} aria-describedby={describedBy} {...rest}>
          {children}
        </select>
      )}
    </FieldShell>
  );
}
