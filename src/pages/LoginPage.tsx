import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, ChevronDown, Loader2, Mail, Lock } from 'lucide-react';
import Logo from '@/components/Logo';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/Toast';
import { signIn, friendlyAuthError } from '@/services/authService';
import { FullPageSpinner } from '@/components/Spinner';

const schema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const { user, isAdmin, loading, configError } = useAuth();
  const { show } = useToast();
  const navigate = useNavigate();
  const [showPwd, setShowPwd] = useState(false);
  const [adminSectionOpen, setAdminSectionOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
  if (user) return <Navigate to={isAdmin ? '/admin/dashboard' : '/employee/dashboard'} replace />;

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

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
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
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {/* Admin demo section */}
          <div className="mt-6 rounded-lg border border-gray-200 bg-slate-50">
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
          </div>

          <p className="mt-6 text-center text-sm text-gray-600">
            Don’t have an account?{' '}
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
