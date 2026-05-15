import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { APP_CONFIG } from './config';

export type UserRole = 'admin' | 'maintainer' | 'coop' | 'public';

let app: FirebaseApp | null = null;

export function isFirebaseConfigured(): boolean {
  const { apiKey, authDomain, projectId, appId } = APP_CONFIG.firebase;
  return Boolean(apiKey && authDomain && projectId && appId);
}

function firebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured()) throw new Error('Firebase auth is not configured');
  if (!app) app = initializeApp(APP_CONFIG.firebase);
  return app;
}

export function subscribeAuth(callback: (user: User | null) => void): () => void {
  if (!isFirebaseConfigured()) {
    callback(null);
    return () => undefined;
  }
  return onAuthStateChanged(getAuth(firebaseApp()), callback);
}

export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(getAuth(firebaseApp()), provider);
  return result.user;
}

export async function signOutUser(): Promise<void> {
  if (!isFirebaseConfigured()) return;
  await signOut(getAuth(firebaseApp()));
}

export function roleForEmail(email?: string | null): UserRole {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return 'public';
  if (APP_CONFIG.roleEmails.admin.includes(normalized)) return 'admin';
  if (APP_CONFIG.roleEmails.maintainer.includes(normalized)) return 'maintainer';
  return 'coop';
}
