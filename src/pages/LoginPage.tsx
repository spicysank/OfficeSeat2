import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, ChevronDown, Loader as Loader2, Mail, Lock } from 'lucide-react';
import Logo from '@/components/Logo';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/Toast';
import {
  signIn,
  signInWithGoogle,
  signInWithMicrosoft,
  friendlyAuthError,
} from '@/services/authService';
import { FullPageSpinner } from '@/components/Spinner';

const schema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

type FormValues = z.infer<typeof schema>;

function GoogleIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
        fill="#EA4335"
      />
    </svg>
  );
}

function MicrosoftIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="2" width="9" height="9" fill="#F25022" />
      <rect x="13" y="2" width="9" height="9" fill="#7FBA00" />
      <rect x="2" y="13" width="9" height="9" fill="#00A4EF" />
      <rect x="13" y="13" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

export default function LoginPage() {
  const { user, isAdmin, loading, configError, needsEmailVerification } = useAuth();
  const { show } = useToast();
  const navigate = useNavigate();
  const [showPwd, setShowPwd] = useState(false);
  const [adminSectionOpen, setAdminSectionOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | 'microsoft' | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  if (loading) return <FullPageSpinner label="Loading…" />;
  if (configError) return <Navigate to="/login" replace />;
  if (user && !needsEmailVerification)
    return <Navigate to={isAdmin ? '/admin/dashboard' : '/employee/dashboard'} replace />;

  const email = watch('email');

  const fillAdmin = () => {
    setValue('email', 'admin@officeseat.demo');
    setValue('password', 'AdminDemo!2026');
    setAdminSectionOpen(true);
  };

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const { profile } = await signIn(values.email, values.password);
      if (!profile?.active) {
        show('This account has been disabled. Contact your administrator.', 'error');
        return;
      }
      show('Welcome back!', 'success');
      const admin = profile.role === 'admin';
      navigate(admin ? '/admin/dashboard' : '/employee/dashboard', { replace: true });
    } catch (err) {
      const e = err as { code?: string; message?: string };
      show(friendlyAuthError(e.code), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setSocialLoading('google');
    try {
      const { profile } = await signInWithGoogle();
      if (!profile?.active) {
        show('This account has been disabled. Contact your administrator.', 'error');
        return;
      }
      show('Welcome back!', 'success');
      navigate(profile.role === 'admin' ? '/admin/dashboard' : '/employee/dashboard', {
        replace: true,
      });
    } catch (err) {
      const e = err as { code?: string };
      show(friendlyAuthError(e.code), 'error');
    } finally {
      setSocialLoading(null);
    }
  };

  const handleMicrosoft = async () => {
    setSocialLoading('microsoft');
    try {
      const { profile } = await signInWithMicrosoft();
      if (!profile?.active) {
        show('This account has been disabled. Contact your administrator.', 'error');
        return;
      }
      show('Welcome back!', 'success');
      navigate(profile.role === 'admin' ? '/admin/dashboard' : '/employee/dashboard', {
        replace: true,
      });
    } catch (err) {
      const e = err as { code?: string };
      show(friendlyAuthError(e.code), 'error');
    } finally {
      setSocialLoading(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 lg:flex-row">
      {/* Left brand panel */}
      <div className="relative hidden flex-1 bg-gradient-to-br from-navy-800 via-navy-700 to-indigo-700 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Logo className="h-11 w-11" iconClass="h-6 w-6" />
        <div className="text-white">
          <h2 className="text-3xl font-bold leading-tight">
            Your Workspace.<br />Your Seat.<br />Your Choice.
          </h2>
          <p className="mt-4 max-w-md text-navy-100">
            OfficeSeat lets your team reserve desks on a real office floor
            plan. Admins place seats exactly where the chairs are.
          </p>
        </div>
        <p className="text-xs text-navy-200">
          © {new Date().getFullYear()} OfficeSeat. Smart office seating.
        </p>
      </div>

      {/* Right form */}
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 flex justify-center lg:hidden">
            <Logo />
          </div>
          <h1 className="text-2xl font-bold text-navy-800">Sign in</h1>
          <p className="mt-1 text-sm text-gray-500">
            Welcome back. Sign in to manage your seats.
          </p>

          {/* Social sign-in buttons */}
          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={handleGoogle}
              disabled={socialLoading !== null || submitting}
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-60"
            >
              {socialLoading === 'google' ? (
                <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
              ) : (
                <GoogleIcon />
              )}
              {socialLoading === 'google' ? 'Connecting…' : 'Continue with Google'}
            </button>
            <button
              type="button"
              onClick={handleMicrosoft}
              disabled={socialLoading !== null || submitting}
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-60"
            >
              {socialLoading === 'microsoft' ? (
                <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
              ) : (
                <MicrosoftIcon />
              )}
              {socialLoading === 'microsoft' ? 'Connecting…' : 'Continue with Microsoft'}
            </button>
          </div>

          {/* Divider */}
          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs font-medium uppercase text-gray-400">or</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
                  autoComplete="current-password"
                  {...register('password')}
                  className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-10 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>

            <div className="flex justify-end">
              <Link
                to="/forgot-password"
                className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={submitting || socialLoading !== null}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {/* Admin demo section */}
          {/* <div className="mt-6 rounded-lg border border-gray-200 bg-slate-50">
            <button
              type="button"
              onClick={() => setAdminSectionOpen((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-gray-700"
            >
              <span>Admin Demo Login</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${adminSectionOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {adminSectionOpen && (
              <div className="border-t border-gray-200 px-4 py-3">
                <p className="text-xs text-gray-500">
                  Use the predefined admin demo account to explore the admin
                  experience. You must provision this account first with{' '}
                  <code className="rounded bg-gray-200 px-1">npm run seed-admin</code>.
                </p>
                <div className="mt-3 rounded-md bg-white p-3 text-xs text-gray-600 ring-1 ring-gray-200">
                  <p><strong>Email:</strong> admin@officeseat.demo</p>
                  <p><strong>Password:</strong> AdminDemo!2026</p>
                </div>
                <button
                  type="button"
                  onClick={fillAdmin}
                  disabled={email === 'admin@officeseat.demo'}
                  className="mt-3 w-full rounded-lg bg-navy-700 px-3 py-2 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-60"
                >
                  Fill Admin Credentials
                </button>
              </div>
            )}
          </div> */}

          <p className="mt-6 text-center text-sm text-gray-600">
            Don't have an account?{' '}
            <Link to="/signup" className="font-semibold text-indigo-600 hover:text-indigo-700">
              Create one
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
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
