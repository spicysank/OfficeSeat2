import { auth } from '@/lib/firebase';
import { isAdminEmail, normalizeEmail } from '@/lib/admin';
import { ensureUserProfile, getUserProfile } from '@/services/userService';
import type { UserProfile } from '@/types';
import {
  createUserWithEmailAndPassword,
  getIdTokenResult,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';

export function friendlyAuthError(code: string | undefined): string {
  const map: Record<string, string> = {
    'auth/invalid-email': 'That email address looks invalid.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/user-not-found': 'No account found with those credentials.',
    'auth/wrong-password': 'Incorrect email or password.',
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/weak-password': 'Password should be at least 6 characters.',
    'auth/too-many-requests':
      'Too many attempts. Please wait a moment and try again.',
    'auth/network-request-failed':
      'Network error. Check your connection and try again.',
    'auth/operation-not-allowed':
      'Email/password sign-in is not enabled for this project.',
    'auth/requires-recent-login':
      'Please sign out and sign back in, then try again.',
  };
  return (code && map[code]) || 'Something went wrong. Please try again.';
}

export async function signIn(
  email: string,
  password: string,
): Promise<{ user: import('firebase/auth').User; profile: UserProfile }> {
  if (!auth) throw new Error('Firebase Auth is not initialized.');
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const profile = await ensureUserProfile(
    cred.user.uid,
    cred.user.email || email,
    cred.user.displayName || email.split('@')[0],
  );
  return { user: cred.user, profile };
}

export async function register(
  displayName: string,
  email: string,
  password: string,
): Promise<{ user: import('firebase/auth').User; profile: UserProfile }> {
  if (!auth) throw new Error('Firebase Auth is not initialized.');
  const normalized = normalizeEmail(email);
  if (isAdminEmail(normalized)) {
    throw new Error(
      'This email is reserved for the Admin account and cannot be used for sign-up.',
    );
  }
  const cred = await createUserWithEmailAndPassword(auth, normalized, password);
  await updateProfile(cred.user, { displayName });
  const profile = await ensureUserProfile(
    cred.user.uid,
    normalized,
    displayName,
  );
  return { user: cred.user, profile };
}

export async function resetPassword(email: string): Promise<void> {
  if (!auth) throw new Error('Firebase Auth is not initialized.');
  await sendPasswordResetEmail(auth, email);
}

export async function logout(): Promise<void> {
  if (!auth) throw new Error('Firebase Auth is not initialized.');
  await signOut(auth);
}

export async function isCurrentUserAdmin(): Promise<boolean> {
  if (!auth || !auth.currentUser) return false;
  const token = await getIdTokenResult(auth.currentUser, true);
  if (token.claims.admin === true) return true;
  const profile = await getUserProfile(auth.currentUser.uid);
  return Boolean(profile && profile.role === 'admin');
}

export async function refreshIdToken(): Promise<void> {
  if (!auth || !auth.currentUser) return;
  await getIdTokenResult(auth.currentUser, true);
}
