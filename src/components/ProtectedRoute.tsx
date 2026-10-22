import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { FullPageSpinner } from '@/components/Spinner';
import Logo from '@/components/Logo';
import EmailVerificationGate from '@/components/EmailVerificationGate';
import { isFirebaseConfigured } from '@/lib/firebase';

export function ProtectedRoute({ adminOnly = false }: { adminOnly?: boolean }) {
  const { user, isAdmin, loading, configError, needsEmailVerification } = useAuth();
  const location = useLocation();

  if (configError) {
    return <ConfigErrorScreen messages={configError} />;
  }

  if (loading) return <FullPageSpinner label="Restoring your session…" />;

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (needsEmailVerification) {
    return <EmailVerificationGate />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/employee/dashboard" replace />;
  }

  return <Outlet />;
}

export function AdminRoute() {
  return <ProtectedRoute adminOnly />;
}

export function PublicOnlyRoute() {
  const { user, isAdmin, loading, configError } = useAuth();
  if (configError) return <ConfigErrorScreen messages={configError} />;
  if (loading) return <FullPageSpinner label="Loading…" />;
  if (user) return <Navigate to={isAdmin ? '/admin/dashboard' : '/employee/dashboard'} replace />;
  return <Outlet />;
}

export function RootRedirect() {
  const { user, isAdmin, loading, configError } = useAuth();
  if (configError) return <ConfigErrorScreen messages={configError} />;
  if (loading) return <FullPageSpinner label="Loading…" />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={isAdmin ? '/admin/dashboard' : '/employee/dashboard'} replace />;
}

export function ConfigErrorScreen({
  messages,
}: {
  messages: string[];
}) {
  const configured = isFirebaseConfigured();
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-lg rounded-xl bg-white p-8 shadow-lg ring-1 ring-gray-200">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <h1 className="text-xl font-bold text-navy-800">
          {configured ? 'Setup incomplete' : 'Firebase configuration missing'}
        </h1>
        <div className="mt-4 space-y-3 text-sm text-gray-600">
          {messages.map((m, i) => (
            <p key={i}>{m}</p>
          ))}
          <div className="rounded-lg bg-slate-50 p-4 text-xs text-gray-600">
            <p className="font-semibold text-gray-700">Steps:</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Create a Firebase project at console.firebase.google.com.</li>
              <li>Enable Email/Password in Authentication.</li>
              <li>Create a Firestore database.</li>
              <li>Copy your web app config into <code>.env</code> (see <code>.env.example</code>).</li>
              <li>Run <code>npm run seed-admin</code> to provision the Admin account.</li>
              <li>Restart the dev server.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
