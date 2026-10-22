import { useState } from 'react';
import { MailCheck, RefreshCw, LogOut, Mail } from 'lucide-react';
import Logo from '@/components/Logo';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/Toast';
import { resendVerificationEmail, logout as authLogout } from '@/services/authService';
import { useNavigate } from 'react-router-dom';

export default function EmailVerificationGate() {
  const { user, reloadUser } = useAuth();
  const { show } = useToast();
  const navigate = useNavigate();
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);

  const handleResend = async () => {
    setSending(true);
    try {
      await resendVerificationEmail();
      show('Verification email sent. Check your inbox.', 'success');
    } catch (err) {
      const e = err as { code?: string };
      show(
        e.code === 'auth/too-many-requests'
          ? 'Too many requests. Please wait before requesting another email.'
          : 'Could not send verification email. Please try again.',
        'error',
      );
    } finally {
      setSending(false);
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg ring-1 ring-gray-200">
        <div className="mb-6 flex justify-center">
          <Logo />
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
            disabled={sending}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
          >
            <Mail className="h-4 w-4" />
            {sending ? 'Sending…' : 'Resend verification email'}
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
