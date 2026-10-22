import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { auth } from '@/lib/firebase';
import { isFirebaseConfigured } from '@/lib/firebase';
import { getUserProfile } from '@/services/userService';
import { logout as authLogout } from '@/services/authService';
import { isAdminEmail } from '@/lib/admin';
import type { UserProfile } from '@/types';
import {
  onAuthStateChanged,
  getIdTokenResult,
  reload,
  type User,
} from 'firebase/auth';

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  loading: boolean;
  configError: string[] | null;
  needsEmailVerification: boolean;
  refresh: () => Promise<void>;
  reloadUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function determineAdmin(u: User): Promise<boolean> {
  const token = await getIdTokenResult(u, true);
  if (token.claims.admin === true) return true;
  if (isAdminEmail(u.email || '')) {
    const p = await getUserProfile(u.uid);
    return Boolean(p && p.role === 'admin');
  }
  return false;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState<string[] | null>(null);
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setConfigError([
        'Firebase is not configured. Copy .env.example to .env and fill in your Firebase project values, then restart the dev server.',
      ]);
      setLoading(false);
      return;
    }
    if (!auth) {
      setConfigError(['Firebase failed to initialize. Check your .env values.']);
      setLoading(false);
      return;
    }

    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!mountedRef.current) return;
      if (!u) {
        setUser(null);
        setProfile(null);
        setIsAdmin(false);
        setNeedsEmailVerification(false);
        setLoading(false);
        return;
      }
      setUser(u);
      try {
        const adminFlag = await determineAdmin(u);
        if (!mountedRef.current) return;

        if (!u.emailVerified && !adminFlag) {
          setNeedsEmailVerification(true);
          setProfile(null);
          setIsAdmin(false);
          setLoading(false);
          return;
        }

        setNeedsEmailVerification(false);
        const p = await getUserProfile(u.uid);
        if (!mountedRef.current) return;
        setProfile(p);
        setIsAdmin(adminFlag);
      } catch (err) {
        console.error('Auth profile load failed', err);
        if (!mountedRef.current) return;
        setProfile(null);
        setIsAdmin(false);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  const refresh = async () => {
    if (!auth?.currentUser) return;
    const u = auth.currentUser;
    setUser(u);
    try {
      const adminFlag = await determineAdmin(u);
      if (!u.emailVerified && !adminFlag) {
        setNeedsEmailVerification(true);
        setProfile(null);
        setIsAdmin(false);
        return;
      }
      setNeedsEmailVerification(false);
      const p = await getUserProfile(u.uid);
      setProfile(p);
      setIsAdmin(adminFlag);
    } catch (err) {
      console.error('Refresh failed', err);
    }
  };

  const reloadUser = async () => {
    if (!auth?.currentUser) return;
    await reload(auth.currentUser);
    const u = auth.currentUser;
    setUser(u);
    if (u && u.emailVerified) {
      setNeedsEmailVerification(false);
      await refresh();
    }
  };

  const logout = async () => {
    await authLogout();
    setUser(null);
    setProfile(null);
    setIsAdmin(false);
    setNeedsEmailVerification(false);
  };

  const value = useMemo<AuthContextValue>(
    () => ({ user, profile, isAdmin, loading, configError, needsEmailVerification, refresh, reloadUser, logout }),
    [user, profile, isAdmin, loading, configError, needsEmailVerification],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
