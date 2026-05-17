import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAnalytics, isSupported as analyticsSupported } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-analytics.js";
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  initializeFirestore,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

export const firebaseConfig = {
  apiKey: "AIzaSyDuUBvCFg7Twlz1AHJ7lVipf1BSBHpakTk",
  authDomain: "event-7b1bf.firebaseapp.com",
  projectId: "event-7b1bf",
  storageBucket: "event-7b1bf.firebasestorage.app",
  messagingSenderId: "566837344073",
  appId: "1:566837344073:web:76617e1a03142b496d8c98",
  measurementId: "G-PFN3ZYS028"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true
});
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

// Use localStorage so auth state persists reliably across page navigations
const persistenceReady = setPersistence(auth, browserLocalPersistence).catch(() => {});

export const analytics = analyticsSupported()
  .then(supported => supported ? getAnalytics(app) : null)
  .catch(() => null);

// Expose persistenceReady so auth.js can await it before sign-in
window.SmartFirebase = {
  persistenceReady,
  app,
  auth,
  db,
  storage,
  googleProvider,
  analytics,
  authApi: {
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    sendPasswordResetEmail,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    updateProfile
  },
  dbApi: {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    increment,
    limit,
    onSnapshot,
    orderBy,
    query,
    runTransaction,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
    writeBatch
  }
};
window.dispatchEvent(new CustomEvent("smartfirebase:ready"));
