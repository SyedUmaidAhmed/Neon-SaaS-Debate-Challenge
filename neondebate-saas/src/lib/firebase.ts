import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

// Error handling wrapper for initialization
let app;
let auth: ReturnType<typeof getAuth>;
export let db: ReturnType<typeof getFirestore>;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  console.error("Firebase initialization error", error);
}

const googleProvider = new GoogleAuthProvider();

export const loginWithGoogle = async () => {
  if (!auth) throw new Error("Firebase Auth not initialized.");
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    // Save user profile to Firestore
    if (db && user) {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        lastLoginAt: new Date().toISOString()
      }, { merge: true });
    }
    
    return user;
  } catch (error) {
    console.error("Google Sign-In Error", error);
    throw error;
  }
};

export const logoutGoogle = async () => {
  if (!auth) return;
  await signOut(auth);
};

export { auth };
