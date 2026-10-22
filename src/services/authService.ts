import { auth } from '@/lib/firebase';
import { isAdminEmail, normalizeEmail } from '@/lib/admin';
import { ensureUserProfile, getUserProfile } from '@/services/userService';
import type { UserProfile } from '@/types';
import {
  createUserWithEmailAndPassword,
  getIdTokenResult,
  GoogleAuthProvider,
  OAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
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
    'auth/popup-closed-by-user':
      'The sign-in popup was closed before completing. Please try again.',
    'auth/cancelled-popup-request':
      'The sign-in popup was cancelled. Please try again.',
    'auth/popup-blocked':
      'The sign-in popup was blocked by your browser. Please allow popups for this site.',
    'auth/operation-not-supported-in-this-environment':
      'This sign-in method is not supported in this environment.',
  };
  return (code && map[code]) || 'Something went wrong. Please try again.';
}

export async function signIn(
  email: string,
  password: string,
): Promise<{ user: User; profile: UserProfile }> {
  if (!auth) throw new Error('Firebase Auth is not initialized.');
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const profile = await ensureUserProfile(
    cred.user.uid,
    cred.user.email || email,
    cred.user.displayName || email.split('@')[0],
  );
  return { user: cred.user, profile };
}

export async function signInWithGoogle(): Promise<{ user: User; profile: UserProfile }> {
  if (!auth) throw new Error('Firebase Auth is not initialized.');
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(auth, provider);
  const profile = await ensureUserProfile(
    cred.user.uid,
    cred.user.email || '',
    cred.user.displayName || (cred.user.email ? cred.user.email.split('@')[0] : 'Employee'),
  );
  return { user: cred.user, profile };
}

export async function signInWithMicrosoft(): Promise<{ user: User; profile: UserProfile }> {
  if (!auth) throw new Error('Firebase Auth is not initialized.');
  const provider = new OAuthProvider('microsoft.com');
  const cred = await signInWithPopup(auth, provider);
  const profile = await ensureUserProfile(
    cred.user.uid,
    cred.user.email || '',
    cred.user.displayName || (cred.user.email ? cred.user.email.split('@')[0] : 'Employee'),
  );
  return { user: cred.user, profile };
}

export async function register(
  displayName: string,
  email: string,
  password: string,
): Promise<{ user: User; profile: UserProfile }> {
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
  await sendEmailVerification(cred.user);
  return { user: cred.user, profile };
}

export async function resendVerificationEmail(): Promise<void> {
  if (!auth) throw new Error('Firebase Auth is not initialized.');
  if (!auth.currentUser) throw new Error('No user is currently signed in.');
  await sendEmailVerification(auth.currentUser);
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
