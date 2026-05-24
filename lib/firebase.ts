import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, linkWithPopup } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer, getDoc, setDoc, getDocFromCache } from 'firebase/firestore';
import firebaseConfigFromFile from '../firebase-applet-config.json';

const getEnv = (key: string): string | undefined => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const val = import.meta.env[`VITE_${key}`] || import.meta.env[key];
    if (val) return val;
  }
  try {
    if (typeof process !== 'undefined' && process.env) {
      const val = process.env[`VITE_${key}`] || process.env[key];
      if (val) return val;
    }
  } catch (e) {
    // ignore
  }
  return undefined;
};

const firebaseConfig = {
  apiKey: getEnv('FIREBASE_API_KEY') || firebaseConfigFromFile.apiKey,
  authDomain: getEnv('FIREBASE_AUTH_DOMAIN') || firebaseConfigFromFile.authDomain,
  projectId: getEnv('FIREBASE_PROJECT_ID') || firebaseConfigFromFile.projectId,
  storageBucket: getEnv('FIREBASE_STORAGE_BUCKET') || firebaseConfigFromFile.storageBucket,
  messagingSenderId: getEnv('FIREBASE_MESSAGING_SENDER_ID') || firebaseConfigFromFile.messagingSenderId,
  appId: getEnv('FIREBASE_APP_ID') || firebaseConfigFromFile.appId,
  measurementId: getEnv('FIREBASE_MEASUREMENT_ID') || firebaseConfigFromFile.measurementId,
  firestoreDatabaseId: getEnv('FIREBASE_FIRESTORE_DATABASE_ID') || (firebaseConfigFromFile as any).firestoreDatabaseId,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const firestoreId = firebaseConfig.firestoreDatabaseId || '';
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, firestoreId === '' ? undefined : firestoreId); /* CRITICAL: The app will break without this line */

const provider = new GoogleAuthProvider();
provider.setCustomParameters({
  prompt: 'consent',
  access_type: 'offline'
});
// Required Scopes for Google Workspace APIs
provider.addScope('https://www.googleapis.com/auth/tasks');
provider.addScope('https://www.googleapis.com/auth/calendar');
provider.addScope('https://www.googleapis.com/auth/drive');
provider.addScope('https://www.googleapis.com/auth/documents');
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/presentations');
provider.addScope('https://www.googleapis.com/auth/forms.body');
provider.addScope('https://www.googleapis.com/auth/forms.responses.readonly');
provider.addScope('https://www.googleapis.com/auth/contacts');
provider.addScope('https://www.googleapis.com/auth/userinfo.profile');
provider.addScope('https://www.googleapis.com/auth/userinfo.email');
provider.addScope('https://www.googleapis.com/auth/gmail.send');
provider.addScope('https://www.googleapis.com/auth/gmail.modify');
provider.addScope('https://www.googleapis.com/auth/gmail.readonly');
provider.addScope('https://www.googleapis.com/auth/chat.messages');
provider.addScope('https://www.googleapis.com/auth/chat.spaces');
provider.addScope('https://www.googleapis.com/auth/meetings.space.created');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      const token = await getAccessToken();
      if (onAuthSuccess) onAuthSuccess(user, token || '');
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    let result;
    const currentUser = auth.currentUser;
    
    if (currentUser) {
      try {
        console.log('Attempting to link existing user account with Google Provider...');
        result = await linkWithPopup(currentUser, provider);
      } catch (linkErr: any) {
        if (linkErr.code === 'auth/credential-already-in-use') {
          console.warn('Google account already linked to another user. Signing into that account instead...');
          result = await signInWithPopup(auth, provider);
        } else if (linkErr.code === 'auth/provider-already-linked') {
          console.log('Google account already linked to this user. Re-authenticating to get fresh token...');
          result = await signInWithPopup(auth, provider);
        } else {
          console.warn('Linking failed, falling back to standard sign in:', linkErr);
          result = await signInWithPopup(auth, provider);
        }
      }
    } else {
      result = await signInWithPopup(auth, provider);
    }

    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    
    try {
      localStorage.setItem(`eburon_at_${result.user.uid}`, cachedAccessToken);
    } catch (localStoreErr) {
      console.warn('Failed to cache token to localStorage:', localStoreErr);
    }

    // Securely persist Google OAuth user info, settings & credentials in the user's Firestore document
    try {
      const updateData: any = {
        email: result.user.email,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL,
        accessToken: cachedAccessToken,
        updatedAt: new Date().toISOString()
      };
      if (result.user.displayName) {
        updateData.settings = {
          userCallName: result.user.displayName
        };
      }
      await setDoc(doc(db, 'users', result.user.uid), updateData, { merge: true });
    } catch (fsErr) {
      console.error('Failed to save authenticated user / token to Firestore of sign in:', fsErr);
    }

    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (cachedAccessToken) {
    return cachedAccessToken;
  }
  const currentUser = auth.currentUser;
  if (currentUser) {
    // 1. Instantly check localStorage for offline survival and speed
    try {
      const localToken = localStorage.getItem(`eburon_at_${currentUser.uid}`);
      if (localToken) {
        cachedAccessToken = localToken;
        return localToken;
      }
    } catch (localStoreErr) {
      console.warn('Could not read token from localStorage cache:', localStoreErr);
    }

    // 2. Fetch from Firestore (falling back to cache upon offline exception)
    try {
      const userDocRef = doc(db, 'users', currentUser.uid);
      let userSnap;
      try {
        userSnap = await getDoc(userDocRef);
      } catch (err: any) {
        const isOffline = err?.message?.toLowerCase().includes('offline') || err?.code === 'unavailable';
        if (isOffline) {
          console.warn('Firestore is offline, attempting to resolve token from local cache...');
          try {
            userSnap = await getDocFromCache(userDocRef);
          } catch (cacheErr) {
            console.warn('Failed to retrieve token from Firestore client cache:', cacheErr);
          }
        } else {
          throw err;
        }
      }

      if (userSnap && userSnap.exists()) {
        const data = userSnap.data();
        if (data && data.accessToken) {
          cachedAccessToken = data.accessToken;
          try {
            localStorage.setItem(`eburon_at_${currentUser.uid}`, data.accessToken);
          } catch (_) {}
          return data.accessToken;
        }
      }
    } catch (e) {
      console.error('Error fetching token from Firestore:', e);
    }
  }
  return null;
};

export const logout = async () => {
  const currentUser = auth.currentUser;
  if (currentUser) {
    try {
      localStorage.removeItem(`eburon_at_${currentUser.uid}`);
    } catch (_) {}
  }
  await auth.signOut();
  cachedAccessToken = null;
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
