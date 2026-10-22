import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader as Loader2, Mail, Lock, User, Check, MailCheck, RefreshCw, LogOut } from 'lucide-react';
import Logo from '@/components/Logo';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/Toast';
import {
  register as registerUser,
  resendVerificationEmail,
  friendlyAuthError,
  logout as authLogout,
} from '@/services/authService';
import { FullPageSpinner } from '@/components/Spinner';

const schema = z
  .object({
    displayName: z.string().min(2, 'Enter your full name.'),
    email: z.string().email('Enter a valid email address.'),
    password: z.string().min(6, 'Password must be at least 6 characters.'),
    confirmPassword: z.string(),
    terms: z
      .boolean()
      .refine((v) => v === true, 'You must accept the terms to continue.'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

function scorePassword(pw: string): { score: number; label: string; color: string } {
  let s = 0;
  if (pw.length >= 6) s++;
  if (pw.length >= 10) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const labels = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong'];
  const colors = ['bg-rose-500', 'bg-rose-500', 'bg-amber-500', 'bg-yellow-400', 'bg-lime-500', 'bg-emerald-500'];
  return { score: s, label: labels[s], color: colors[s] };
}

export default function SignupPage() {
  const { user, isAdmin, loading, configError, reloadUser } = useAuth();
  const { show } = useToast();
  const navigate = useNavigate();
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      displayName: '',
      email: '',
      password: '',
      confirmPassword: '',
      terms: false,
    },
  });

  const pw = watch('password');
  const strength = useMemo(() => scorePassword(pw || ''), [pw]);

  if (loading) return <FullPageSpinner label="Loading…" />;
  if (configError) return <Navigate to="/login" replace />;
  if (user && !registered && !configError) {
    return <Navigate to={isAdmin ? '/admin/dashboard' : '/employee/dashboard'} replace />;
  }

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      await registerUser(values.displayName, values.email, values.password);
      setRegistered(true);
      show('Account created! Check your email for a verification link.', 'success');
    } catch (err) {
      const e = err as { code?: string; message?: string };
      show(e.message || friendlyAuthError(e.code), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await resendVerificationEmail();
      show('Verification email re-sent. Check your inbox.', 'success');
    } catch (err) {
      const e = err as { code?: string };
      show(
        e.code === 'auth/too-many-requests'
          ? 'Too many requests. Please wait before requesting another email.'
          : 'Could not send verification email. Please try again.',
        'error',
      );
    } finally {
      setResending(false);
    }
  };

  const handleCheckVerified = async () => {
    setChecking(true);
    try {
      await reloadUser();
    } catch {
      show('Could not check verification status. Please try again.', 'error');
    } finally {
      setChecking(false);
    }
  };

  const handleSignOut = async () => {
    await authLogout();
    navigate('/login', { replace: true });
  };

  if (registered) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg ring-1 ring-gray-200">
          <div className="mb-6 flex justify-center">
            <Logo className="h-10 w-40" />
          </div>
          <div className="flex flex-col items-center text-center">
            <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
              <MailCheck className="h-7 w-7 text-amber-600" />
            </span>
            <h1 className="text-xl font-bold text-navy-800">Verify your email</h1>
            <p className="mt-2 text-sm text-gray-600">
              We sent a verification link to
              <br />
              <strong className="text-navy-700">{user?.email}</strong>
            </p>
            <p className="mt-3 text-xs text-gray-500">
              Click the link in the email to activate your account, then come back
              and click the button below.
            </p>
          </div>

          <div className="mt-6 space-y-3">
            <button
              onClick={handleCheckVerified}
              disabled={checking}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
              {checking ? 'Checking…' : "I've verified my email"}
            </button>
            <button
              onClick={handleResend}
              disabled={resending}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
            >
              <Mail className="h-4 w-4" />
              {resending ? 'Sending…' : 'Resend verification email'}
            </button>
            <button
              onClick={handleSignOut}
              className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-500 transition hover:text-gray-700"
            >
              <LogOut className="h-4 w-4" />
              Use a different account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 lg:flex-row">
      <div className="relative hidden flex-1 bg-gradient-to-br from-indigo-700 via-navy-700 to-navy-800 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Logo className="h-12 w-40" />
        <div className="text-white">
          <h2 className="text-3xl font-bold leading-tight">
            Find your seat.<br />Plan your day.
          </h2>
          <p className="mt-4 max-w-md text-navy-100">
            Create an account to reserve desks on your office floor plan,
            view upcoming bookings, and manage your workspace.
          </p>
        </div>
        <p className="text-xs text-navy-200">
          © {new Date().getFullYear()} OfficeSeat
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 flex justify-center lg:hidden">
            <Logo className="h-10 w-40" />
          </div>
          <h1 className="text-2xl font-bold text-navy-800">Create your account</h1>
          <p className="mt-1 text-sm text-gray-500">
            Every new account is an Employee account by default. You'll need to
            verify your email before signing in.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <Field label="Full name" error={errors.displayName?.message}>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  {...register('displayName')}
                  className="w-full rounded-lg border border-gray-300 pl-10 pr-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                  placeholder="Jordan Lee"
                />
              </div>
            </Field>
            <Field label="Email" error={errors.email?.message}>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  autoComplete="email"
                  {...register('email')}
                  className="w-full rounded-lg border border-gray-300 pl-10 pr-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                  placeholder="you@company.com"
                />
              </div>
            </Field>
            <Field label="Password" error={errors.password?.message}>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPwd ? 'text' : 'password'}
                  autoComplete="new-password"
                  {...register('password')}
                  className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-10 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                  placeholder="At least 6 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {pw && (
                <div className="mt-2">
                  <div className="flex gap-1">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`h-1.5 flex-1 rounded-full ${
                          i < strength.score ? strength.color : 'bg-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{strength.label}</p>
                </div>
              )}
            </Field>
            <Field label="Confirm password" error={errors.confirmPassword?.message}>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  {...register('confirmPassword')}
                  className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-10 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                  placeholder="Re-enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>
            <label className="flex items-start gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                {...register('terms')}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>
                I agree to the{' '}
                <a href="#" className="font-medium text-indigo-600">Terms of Service</a>
                {' '}and{' '}
                <a href="#" className="font-medium text-indigo-600">Privacy Policy</a>.
              </span>
            </label>
            {errors.terms && (
              <p className="text-xs text-rose-600">{errors.terms.message}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {submitting ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-indigo-600 hover:text-indigo-700">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
