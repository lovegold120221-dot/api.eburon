import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, linkWithPopup, Auth } from 'firebase/auth';

let app: FirebaseApp | null = null;
export let auth: Auth;
export const provider = new GoogleAuthProvider();

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

export async function initFirebase() {
  if (app) return { app, auth };
  
  const res = await fetch('/api/config');
  const config = await res.json();
  
  app = initializeApp(config.firebase);
  auth = getAuth(app);
  
  return { app, auth };
}

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const googleSignIn = async (language?: string): Promise<{ user: User; accessToken: string; syncData: any } | null> => {
  try {
    if (!auth) await initFirebase();
    isSigningIn = true;
    let result;
    const currentUser = auth.currentUser;
    
    if (currentUser) {
      try {
        result = await linkWithPopup(currentUser, provider);
      } catch (linkErr: any) {
        result = await signInWithPopup(auth, provider);
      }
    } else {
      result = await signInWithPopup(auth, provider);
    }

    const credential = GoogleAuthProvider.credentialFromResult(result);
    cachedAccessToken = credential?.accessToken || null;
    
    if (cachedAccessToken) {
      try {
        localStorage.setItem(`eburon_at_${result.user.uid}`, cachedAccessToken);
      } catch (_) {}
    }

    // Sync user
    let syncData = null;
    try {
      const idToken = await result.user.getIdToken();
      const syncRes = await fetch('/api/user/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: result.user.email,
          displayName: result.user.displayName,
          photoURL: result.user.photoURL,
          language: language || 'English'
        })
      });
      if (syncRes.ok) syncData = await syncRes.json();
    } catch (e) {}

    return { user: result.user, accessToken: cachedAccessToken || '', syncData };
  } finally {
    isSigningIn = false;
  }
};

export const initAuth = (onAuthSuccess: (user: User, token: string) => void, onAuthFailure: () => void) => {
  initFirebase().then(({ auth }) => {
    return onAuthStateChanged(auth, async (user) => {
      if (user) {
        const token = await getAccessToken();
        onAuthSuccess(user, token || '');
      } else {
        onAuthFailure();
      }
    });
  });
};

export const getFirebaseIdToken = async (): Promise<string | null> => {
  if (!auth) await initFirebase();
  const currentUser = auth.currentUser;
  return currentUser ? currentUser.getIdToken(true) : null;
};

export const getAccessToken = async (): Promise<string | null> => {
  if (cachedAccessToken) return cachedAccessToken;
  if (!auth) await initFirebase();
  const currentUser = auth.currentUser;
  if (currentUser) {
    return localStorage.getItem(`eburon_at_${currentUser.uid}`);
  }
  return null;
};

export const logout = async () => {
  if (!auth) return;
  const currentUser = auth.currentUser;
  if (currentUser) {
    try { localStorage.removeItem(`eburon_at_${currentUser.uid}`); } catch (_) {}
  }
  await auth.signOut();
  cachedAccessToken = null;
};
