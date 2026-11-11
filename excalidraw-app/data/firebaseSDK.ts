// Firebase SDK subset used by the app. Loaded lazily from `./firebase.ts`
// via `import("./firebaseSDK")` so it's not part of the main bundle.
//
// Static re-exports (rather than destructuring `await import("firebase/*")`)
// keep the SDK tree-shakeable — Vite wraps dynamic imports in a preload
// helper, which prevents Rollup from tree-shaking destructured imports.
export { initializeApp } from "firebase/app";
export {
  getFirestore,
  doc,
  getDoc,
  runTransaction,
  Bytes,
} from "firebase/firestore";
export { getStorage, ref, uploadBytes } from "firebase/storage";
