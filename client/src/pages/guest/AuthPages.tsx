import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import type { PublicUser } from '@hotel/shared';
import { useAuth } from '../../auth/AuthContext';
import { ApiError } from '../../api/http';
import { Button } from '../../components/ui/Button';
import { Alert, errorMessage } from '../../components/ui/Feedback';
import { TextField } from '../../components/ui/Field';

/** Only same-app paths are honoured, so `?next=` can't redirect off-site. */
function safeNext(next: string | null, user: PublicUser, isStaff: boolean): string {
  if (next && next.startsWith('/') && !next.startsWith('//')) return next;
  return isStaff || user.role !== 'GUEST' ? '/staff' : '/my-reservations';
}

export function LoginPage() {
  const { login, user, isStaff } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const mutation = useMutation({ mutationFn: login });

  if (user) return <Navigate to={safeNext(params.get('next'), user, isStaff)} replace />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate(
      { email, password },
      { onSuccess: (u) => navigate(safeNext(params.get('next'), u, u.role !== 'GUEST'), { replace: true }) },
    );
  };

  return (
    <section className="auth-card page-top">
      <h1>Sign in</h1>
      <p className="muted">Guests and hotel staff use the same sign-in.</p>
      <form className="form" onSubmit={submit}>
        {mutation.isError && <Alert tone="error">{errorMessage(mutation.error)}</Alert>}
        <TextField label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <TextField label="Password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button type="submit" busy={mutation.isPending} className="btn-block">
          Sign in
        </Button>
      </form>
      <p>
        New here? <Link to={`/register${params.get('next') ? `?next=${encodeURIComponent(params.get('next')!)}` : ''}`}>Create an account</Link>
      </p>
    </section>
  );
}

export function RegisterPage() {
  const { register, user, isStaff } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const mutation = useMutation({ mutationFn: register });
  const fieldErrors = mutation.error instanceof ApiError ? mutation.error.fieldErrors() : {};

  if (user) return <Navigate to={safeNext(params.get('next'), user, isStaff)} replace />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate(form, { onSuccess: (u) => navigate(safeNext(params.get('next'), u, false), { replace: true }) });
  };
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  return (
    <section className="auth-card page-top">
      <h1>Create an account</h1>
      <form className="form" onSubmit={submit} noValidate>
        {mutation.isError && Object.keys(fieldErrors).length === 0 && <Alert tone="error">{errorMessage(mutation.error)}</Alert>}
        <TextField label="Full name" autoComplete="name" required value={form.name} onChange={set('name')} error={fieldErrors.name} />
        <TextField label="Email" type="email" autoComplete="email" required value={form.email} onChange={set('email')} error={fieldErrors.email} />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          value={form.password}
          onChange={set('password')}
          error={fieldErrors.password}
          hint="At least 8 characters, with a letter and a number"
        />
        <Button type="submit" busy={mutation.isPending} className="btn-block">
          Create account
        </Button>
      </form>
      <p>
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </section>
  );
}
