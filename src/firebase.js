// ─── Firebase Core Setup ─────────────────────────────────────────────
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, addDoc, setDoc, doc, query, orderBy, limit, getDocs, onSnapshot, deleteDoc } from "firebase/firestore";

// ─── Firebase Config ─────────────────────────────────────────────────
// Replace these placeholder values with YOUR config from:
//   Firebase Console → Project Settings → Your Apps → Web App → Config
const firebaseConfig = {
  apiKey: "AIzaSyCsQA1ZRKukufy-nIAyhPkdHNHyGW7NSA8",
  authDomain: "ridgehacks-dd944.firebaseapp.com",
  projectId: "ridgehacks-dd944",
  storageBucket: "ridgehacks-dd944.firebasestorage.app",
  messagingSenderId: "908198359513",
  appId: "1:908198359513:web:919cac83eea16dba5629c8",
  measurementId: "G-MZDSQETDEC"
};

// ─── Initialize Firebase ─────────────────────────────────────────────
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// ─── Auth Helpers ────────────────────────────────────────────────────

/** Sign up with email + password */
export const signUpWithEmail = (email, password) => {
  return createUserWithEmailAndPassword(auth, email, password);
};

/** Sign in with email + password */
export const signInWithEmail = (email, password) => {
  return signInWithEmailAndPassword(auth, email, password);
};

/** Sign in with Google popup */
export const signInWithGoogle = () => {
  return signInWithPopup(auth, googleProvider);
};

/** Sign out */
export const logOut = () => {
  return signOut(auth);
};

/** Subscribe to auth state changes — returns an unsubscribe function */
export const onAuthChange = (callback) => {
  return onAuthStateChanged(auth, callback);
};

// ─── Firestore: User Profile ─────────────────────────────────────────

/** Create or update a user profile document (keyed by uid) */
export const saveUserProfile = async (user) => {
  await setDoc(doc(db, "users", user.uid), {
    name: user.displayName || "",
    email: user.email || "",
    createdAt: Date.now()
  }, { merge: true });
};

// ─── Firestore: Game Scores ──────────────────────────────────────────

/**
 * Save a game result.
 * @param {Object} scoreData - { mode, score, avgTemp, ...extras }
 */
export const saveScore = async (scoreData) => {
  const user = auth.currentUser;
  if (!user) throw new Error("Must be signed in to save scores.");

  return addDoc(collection(db, "scores"), {
    userId: user.uid,
    playerName: user.displayName || user.email || "Anonymous",
    mode: scoreData.mode,       // "budget" | "heat-hunt" | "sandbox" | "crisis"
    score: scoreData.score,
    avgTemp: scoreData.avgTemp,
    timestamp: Date.now(),
    ...scoreData.extras          // city type, difficulty, etc.
  });
};

/**
 * Fetch top 10 scores (one-time read).
 * @param {string} mode - optional mode filter
 */
export const getTopScores = async (mode) => {
  const q = query(
    collection(db, "scores"),
    orderBy("score", "desc"),
    limit(10)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/**
 * Real-time leaderboard listener — calls `callback` every time scores change.
 * Returns an unsubscribe function.
 */
export const onLeaderboardUpdate = (callback) => {
  const q = query(
    collection(db, "scores"),
    orderBy("score", "desc"),
    limit(10)
  );
  return onSnapshot(q, (snapshot) => {
    const scores = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(scores);
  });
};

/** Delete all scores from the leaderboard */
export const clearAllScores = async () => {
  const snapshot = await getDocs(collection(db, "scores"));
  const deletes = snapshot.docs.map((d) => deleteDoc(doc(db, "scores", d.id)));
  await Promise.all(deletes);
};

// ─── Exports ─────────────────────────────────────────────────────────
export { app, auth, db };
