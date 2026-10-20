import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import Logo from '@/components/Logo';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/Toast';
import { resetPassword, friendlyAuthError } from '@/services/authService';
import { FullPageSpinner } from '@/components/Spinner';

const schema = z.object({
  email: z.string().email('Enter a valid email address.'),
});
type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const { user, isAdmin, loading, configError } = useAuth();
  const { show } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  if (loading) return <FullPageSpinner label="Loading…" />;
  if (configError) return <Navigate to="/login" replace />;
  if (user) return <Navigate to={isAdmin ? '/admin/dashboard' : '/employee/dashboard'} replace />;

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      await resetPassword(values.email);
      setSent(true);
      show('Password reset email sent. Check your inbox.', 'success');
    } catch (err) {
      const e = err as { code?: string };
      show(friendlyAuthError(e.code), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-xl bg-white p-8 shadow-lg ring-1 ring-gray-200">
          <Link
            to="/login"
            className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>
          <h1 className="text-2xl font-bold text-navy-800">Reset your password</h1>
          <p className="mt-1 text-sm text-gray-500">
            Enter your email and we’ll send you a reset link.
          </p>

          {sent ? (
            <div className="mt-6 flex flex-col items-center gap-3 rounded-lg bg-emerald-50 p-6 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              <p className="text-sm text-gray-700">
                If an account exists for that email, a password reset link has
                been sent. Check your inbox and follow the instructions.
              </p>
              <button
                onClick={() => setSent(false)}
                className="mt-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"
              >
                Send to a different email
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Email
                </label>
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
                {errors.email && (
                  <p className="mt-1 text-xs text-rose-600">{errors.email.message}</p>
                )}
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
