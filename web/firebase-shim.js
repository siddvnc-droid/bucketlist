// Connects the bucket list app to Firebase.
//
// The app talks to its storage through window.claude.use("db"), the same way
// it does when published on claude.ai. This file provides that interface on
// top of Cloud Firestore, so the app itself needs no changes.
//
// Each list lives at lists/<secret id> in Firestore. The secret id is the part
// of the link after "#", so whoever has the link can open and edit that list.
(function () {
  const firebaseConfig = {
    apiKey: "AIzaSyB95TZl4D0Q66VL2-It5QlkAdTi4J02pzA",
    authDomain: "winter-bucket-list.firebaseapp.com",
    projectId: "winter-bucket-list",
    storageBucket: "winter-bucket-list.firebasestorage.app",
    messagingSenderId: "781041733321",
    appId: "1:781041733321:web:b3274b5d737d191b530718",
  };
  const SDK = "https://www.gstatic.com/firebasejs/10.14.1";

  const match = location.hash.slice(1).match(/^[A-Za-z0-9_-]{20,64}$/);
  const listId = match ? match[0] : null;
  addEventListener("hashchange", () => location.reload());

  // Firestore replaces a whole map on update, while the app expects nested
  // objects to merge. Dotted field paths give the merge behaviour.
  function flatten(obj, prefix, out) {
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length) flatten(v, key, out);
      else out[key] = v;
    }
    return out;
  }
  const CODES = { unavailable: "unavailable", "deadline-exceeded": "unavailable", "resource-exhausted": "quota_exceeded", "permission-denied": "invalid_argument", "not-found": "invalid_argument" };
  const wrap = (p) => p.catch((e) => { throw { code: CODES[e && e.code] || "unknown", message: String((e && e.message) || e) }; });

  function makeDb(fs, db) {
    return {
      collection(name) {
        const ref = fs.collection(db, "lists", listId, name);
        return {
          add: (data) => wrap(fs.addDoc(ref, data)),
          doc(id) {
            const d = id ? fs.doc(ref, id) : fs.doc(ref);
            return {
              id: d.id,
              set: (data) => wrap(fs.setDoc(d, data)),
              update: (patch) => wrap(fs.updateDoc(d, flatten(patch, "", {}))),
              delete: () => wrap(fs.deleteDoc(d)),
            };
          },
          onSnapshot(next, error) {
            return fs.onSnapshot(ref,
              (snap) => next({ docs: snap.docs.map((x) => ({ id: x.id, data: () => x.data() })), metadata: snap.metadata }),
              (e) => error && error({ code: e && e.code === "permission-denied" ? "revoked" : "unavailable", message: String((e && e.message) || e) }));
          },
        };
      },
    };
  }

  let dbPromise = null;
  function loadDb() {
    if (!listId) return Promise.resolve(null);
    if (!dbPromise) {
      dbPromise = Promise.all([import(`${SDK}/firebase-app.js`), import(`${SDK}/firebase-firestore.js`)])
        .then(([{ initializeApp }, fs]) => makeDb(fs, fs.getFirestore(initializeApp(firebaseConfig))))
        .catch((e) => { console.error("Could not connect to Firebase", e); return null; });
    }
    return dbPromise;
  }

  window.claude = { use: (name) => (name === "db" ? loadDb() : Promise.resolve(null)) };
  window.__bucketlistTest = { flatten };
})();
