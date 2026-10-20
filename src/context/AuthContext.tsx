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
  type User,
} from 'firebase/auth';

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  loading: boolean;
  configError: string[] | null;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState<string[] | null>(null);
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
        setLoading(false);
        return;
      }
      setUser(u);
      try {
        const token = await getIdTokenResult(u, true);
        let admin = token.claims.admin === true;
        if (!admin && isAdminEmail(u.email || '')) {
          // Fallback: profile role for the reserved admin email.
          const p = await getUserProfile(u.uid);
          admin = Boolean(p && p.role === 'admin');
        }
        const p = await getUserProfile(u.uid);
        if (!mountedRef.current) return;
        setProfile(p);
        setIsAdmin(admin);
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
      const token = await getIdTokenResult(u, true);
      let admin = token.claims.admin === true;
      if (!admin && isAdminEmail(u.email || '')) {
        const p = await getUserProfile(u.uid);
        admin = Boolean(p && p.role === 'admin');
      }
      const p = await getUserProfile(u.uid);
      setProfile(p);
      setIsAdmin(admin);
    } catch (err) {
      console.error('Refresh failed', err);
    }
  };

  const logout = async () => {
    await authLogout();
    setUser(null);
    setProfile(null);
    setIsAdmin(false);
  };

  const value = useMemo<AuthContextValue>(
    () => ({ user, profile, isAdmin, loading, configError, refresh, logout }),
    [user, profile, isAdmin, loading, configError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
