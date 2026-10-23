// Connects the bucket list app to Firebase, with sign-in.
//
// The app talks to its storage through window.claude.use("db") and
// window.claude.use("user"), the same way it does on claude.ai. This file
// provides both on top of Firebase Authentication and Cloud Firestore, so the
// app itself needs no changes.
//
// Each list lives at lists/<list id>, where the id is the part of the link
// after "#". The list document holds the emails allowed to open it; the
// first person to sign in becomes its first member. People sign in with
// Google or an email and password.
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
  // Lists hosted on this site, keyed by a SHA-256 hash of the link id (first 16 hex
  // characters) so the private links can't be read from this public file.
  // Value: the word shown in italics before "Bucket List", and the celebration played
  // when an activity is added ("snow" or "confetti").
  const LISTS = {
    "229b0612c15bde32": { word: "Winter", effect: "snow" },
    "85a6421012a78716": { word: "2027", effect: "confetti" },
    "6d72527ff61fe8d9": { word: "2027", effect: "confetti" }, // the first 2027 link, before it was replaced
  };

  const match = location.hash.slice(1).match(/^[A-Za-z0-9_-]{20,64}$/);
  const listId = match ? match[0] : null;
  addEventListener("hashchange", () => location.reload());
  let listWord = "Our", LIST_NAME = "Our Bucket List";
  // The page heading says "Winter" by default; show this list's own name.
  const nameHeading = () => { const em = document.querySelector("h1 em"); if (em) em.textContent = listWord; document.title = LIST_NAME; };
  const nameReady = (async () => {
    try {
      if (listId) {
        const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(listId));
        const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
        const entry = LISTS[hex];
        listWord = entry ? entry.word : "Our";
        if (entry && entry.effect) document.documentElement.dataset.effect = entry.effect;
      }
    } catch {}
    LIST_NAME = `${listWord} Bucket List`;
    nameHeading();
  })();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", nameHeading); else nameHeading();

  let resolveDb, resolveUser;
  const dbReady = new Promise((r) => (resolveDb = r));
  const userReady = new Promise((r) => (resolveUser = r));
  window.claude = { use: (name) => (name === "db" ? dbReady : name === "user" ? userReady : Promise.resolve(null)) };
  const giveUp = () => { resolveDb(null); resolveUser(null); };
  if (!listId) { giveUp(); return; }

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const S = { F: null, auth: null, db: null, user: null, listRef: null, people: {}, members: { emails: [], phones: [] }, ready: false };

  /* ---------- helpers ---------- */
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
  const CODES = { unavailable: "unavailable", "deadline-exceeded": "unavailable", "resource-exhausted": "quota_exceeded", "permission-denied": "invalid_argument", "not-found": "not_found" };
  const wrap = (p) => p.catch((e) => { throw { code: CODES[e && e.code] || "unknown", message: String((e && e.message) || e) }; });
  // Only a confirmed email counts, the same as in firestore.rules.
  const myEmail = () => (S.user.email && S.user.emailVerified ? S.user.email.toLowerCase() : "");
  const myPhone = () => S.user.phoneNumber || "";
  const isMember = (m) => (myEmail() && (m.emails || []).includes(myEmail())) || (myPhone() && (m.phones || []).includes(myPhone()));
  function colorFor(id) { let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return ["#3B5BA9", "#7A4FB5", "#B35A2E", "#1F7A58", "#A8436E", "#5E7A1E", "#1A7C95", "#5F6873"][h % 8]; }
  function labelFor(p) { return p.name || p.email || (p.phone ? `Phone ending ${p.phone.slice(-4)}` : ""); }
  function initialsAvatar(text, color) {
    const words = String(text || "?").replace(/[^A-Za-z0-9 ]/g, " ").trim().split(/\s+/);
    const ch = (words.length > 1 ? words[0][0] + words[1][0] : (words[0] || "?").slice(0, 2)).toUpperCase();
    return "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="20" fill="${color}"/><text x="20" y="25.5" font-family="Helvetica,Arial,sans-serif" font-size="15" font-weight="600" fill="#fff" text-anchor="middle">${esc(ch)}</text></svg>`);
  }
  function avatarFor(uid) { const p = S.people[uid] || {}; return p.photo || initialsAvatar(p.name || (p.phone ? p.phone.slice(-2) : p.email), colorFor(uid)); }
  function friendly(e) {
    const c = (e && e.code) || "";
    if (e) console.warn("Sign-in error", e);
    const noMatch = "That email and password don't match. Try again or use Forgot password. New here? Tap Create account instead. If you signed in with Google before, use Continue with Google.";
    return ({
      "auth/invalid-email": "That email doesn't look right.",
      "auth/missing-email": "Enter your email first.",
      "auth/missing-password": "Enter your password.",
      "auth/weak-password": "Use a password with at least 6 characters.",
      "auth/email-already-in-use": "There's already an account with this email. Tap Sign in instead, or use Forgot password.",
      "auth/invalid-credential": noMatch,
      "auth/invalid-login-credentials": noMatch,
      "auth/wrong-password": noMatch,
      "auth/user-not-found": noMatch,
      "auth/account-exists-with-different-credential": "This email already signs in another way. Use the button you used before, like Continue with Google.",
      "auth/user-disabled": "This account has been turned off.",
      "auth/cancelled-popup-request": "Finish signing in in the window that's already open.",
      "auth/too-many-requests": "Too many tries. Wait a few minutes and try again.",
      "auth/operation-not-allowed": "This way of signing in isn't turned on for this list yet. Try another one.",
      "auth/unauthorized-domain": "This web address isn't allowed to sign in yet. Add it under Authentication → Settings → Authorized domains.",
      "auth/popup-closed-by-user": "The sign-in window was closed before finishing.",
      "auth/network-request-failed": "Couldn't reach Google. Check your connection and try again.",
    })[c] || `Sign-in didn't work (${c || "unknown error"}). Try again, or use another way to sign in.`;
  }

  /* ---------- storage the app uses ---------- */
  function makeDb() {
    const { F } = S;
    return Object.freeze({
      collection(name) {
        const ref = F.collection(S.db, "lists", listId, name);
        return {
          add: (data) => wrap(F.addDoc(ref, data)),
          doc(id) {
            const d = id ? F.doc(ref, id) : F.doc(ref);
            return {
              id: d.id,
              set: (data) => wrap(F.setDoc(d, data)),
              update: (patch) => wrap(F.updateDoc(d, flatten(patch, "", {}))),
              delete: () => wrap(F.deleteDoc(d)),
            };
          },
          onSnapshot(next, error) {
            return F.onSnapshot(ref,
              (snap) => next({ docs: snap.docs.map((x) => ({ id: x.id, data: () => x.data() })), metadata: snap.metadata }),
              (e) => error && error({ code: e && e.code === "permission-denied" ? "revoked" : "unavailable", message: String((e && e.message) || e) }));
          },
        };
      },
    });
  }
  function makeUser() {
    const uid = S.user.uid;
    const prof = (id) => ({ id, name: labelFor(S.people[id] || {}), avatarUrl: avatarFor(id), color: colorFor(id), email: (S.people[id] || {}).email || null, isMe: id === uid, guest: false });
    return Object.freeze({
      isOwner: async () => true, canEdit: async () => true, can: async () => true,
      id: async () => uid,
      me: async () => ({ ...prof(uid), isOwner: true, canEdit: true }),
      profiles: async (ids) => { const out = {}; for (const id of [].concat(ids)) out[id] = prof(id); return out; },
      name: async () => labelFor(S.people[uid] || {}), avatarUrl: async () => avatarFor(uid),
      search: async () => [], email: async () => S.user.email || null,
    });
  }

  /* ---------- start ---------- */
  boot();
  async function boot() {
    try {
      const [appM, authM, fsM] = await Promise.all([import(`${SDK}/firebase-app.js`), import(`${SDK}/firebase-auth.js`), import(`${SDK}/firebase-firestore.js`)]);
      S.F = { ...authM, ...fsM };
      const app = appM.initializeApp(firebaseConfig);
      S.auth = S.F.getAuth(app);
      S.db = S.F.getFirestore(app);
      S.listRef = S.F.doc(S.db, "lists", listId);
      await nameReady;
      S.F.onAuthStateChanged(S.auth, onUser);
    } catch (e) {
      console.error("Could not connect to Firebase", e);
      giveUp();
    }
  }

  async function onUser(user) {
    if (S.ready) { if (!user || user.uid !== S.user.uid) location.reload(); return; }
    if (!user) { showGate("signin"); return; }
    S.user = user;
    const { F } = S;
    // An email and password account opens lists once its email is confirmed.
    if (user.email && !user.emailVerified && !myPhone()) { showGate("verify"); return; }
    // Only a refusal from the rules means "not on this list"; anything else is a connection problem.
    const failed = (e) => showGate(e && e.code === "permission-denied" ? "denied" : "offline");
    let snap;
    try { snap = await F.getDoc(S.listRef); } catch (e) { failed(e); return; }
    if (!snap.exists()) {
      try {
        await F.setDoc(S.listRef, { emails: myEmail() ? [myEmail()] : [], phones: myPhone() ? [myPhone()] : [], createdBy: user.uid, createdAt: Date.now() });
      } catch (e) {
        // Someone else may have created the list a moment ago: look again.
        try {
          const again = await F.getDoc(S.listRef);
          if (!again.exists()) { failed(e); return; }
          if (!isMember(again.data())) { showGate("denied"); return; }
        } catch (e2) { failed(e2); return; }
      }
    } else if (!isMember(snap.data())) { showGate("denied"); return; }
    // Saving your name and photo for others can happen in the background.
    F.setDoc(F.doc(S.db, "lists", listId, "people", user.uid), { name: user.displayName || "", photo: user.photoURL || "", email: myEmail(), phone: myPhone() }, { merge: true }).catch(() => {});
    F.onSnapshot(F.collection(S.db, "lists", listId, "people"), (snap) => { S.people = {}; snap.forEach((d) => (S.people[d.id] = d.data())); renderPeople(); }, () => {});
    F.onSnapshot(S.listRef, (snap) => { if (snap.exists()) { S.members = snap.data(); renderPeople(); } }, () => {});
    S.ready = true;
    hideGate();
    addPeopleButton();
    resolveDb(makeDb());
    resolveUser(makeUser());
  }

  /* ---------- sign-in screen ---------- */
  const G_ICON = '<svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/></svg>';
  const EMAIL_HINT = "New here? Enter your email, choose a password and tap Create account.";
  function injectCss() {
    if ($("fb-css")) return;
    const st = document.createElement("style"); st.id = "fb-css";
    st.textContent = `
      #fb-gate { position: fixed; inset: 0; z-index: 80; background: var(--bg); display: grid; place-items: center; overflow: auto;
        grid-template-columns: minmax(0, 420px); justify-content: center;
        padding: 24px max(16px, env(safe-area-inset-right, 0px)) 24px max(16px, env(safe-area-inset-left, 0px)); }
      .fb-card { width: 100%; background: var(--surface); border: 1px solid var(--line); border-radius: 22px; box-shadow: var(--shadow-2); padding: 32px 28px 28px; display: flex; flex-direction: column; gap: 14px; }
      .fb-card h2 { font-family: var(--font-display); font-weight: 400; font-size: clamp(32px, 8vw, 40px); line-height: 1; letter-spacing: -0.015em; margin: 2px 0 0; text-wrap: balance; }
      .fb-card p { margin: 0; color: var(--muted); }
      .fb-card b { color: var(--ink); font-weight: 500; overflow-wrap: anywhere; }
      .fb-wide { width: 100%; height: 44px; }
      .fb-or { display: flex; align-items: center; gap: 12px; color: var(--faint); font-size: 12.5px; margin: 4px 0; }
      .fb-or::before, .fb-or::after { content: ""; flex: 1; height: 1px; background: var(--line); }
      .fb-row { display: flex; gap: 8px; }
      .fb-input { flex: 1; min-width: 0; height: 42px; border: 1px solid var(--line-2); border-radius: 11px; padding: 0 12px; background: var(--surface); color: var(--ink); font: inherit; font-size: 16px; }
      .fb-stack { display: flex; flex-direction: column; gap: 8px; }
      .fb-stack .fb-input { flex: none; width: 100%; }
      .fb-row .btn { flex: 1 1 0; height: 42px; }
      .fb-row .fb-input + .btn { flex: none; }
      .fb-links { display: flex; justify-content: space-between; gap: 8px 16px; flex-wrap: wrap; }
      .fb-link { border: 0; background: none; padding: 2px 0; color: var(--ink-2); font: inherit; font-size: 13px; font-weight: 500; text-decoration: underline; text-decoration-color: var(--line-2); text-underline-offset: 3px; cursor: pointer; }
      .fb-link:hover { color: var(--ink); text-decoration-color: currentColor; }
      .fb-social svg { flex: none; }
      .fb-input:focus { outline: none; border-color: var(--focus); box-shadow: 0 0 0 3px color-mix(in srgb, var(--focus) 15%, transparent); }
      .fb-hint { font-size: 13px; color: var(--muted); margin: 0; }
      .fb-hint.err { color: var(--danger); }
      .fb-right { display: inline-flex; align-items: center; gap: 14px; }
      .fb-people-btn { display: inline-flex; align-items: center; gap: 6px; border: 0; background: none; cursor: pointer; padding: 4px 8px; margin: -4px -8px -4px 0; border-radius: 8px; color: var(--ink-2); }
      .fb-people-btn:hover { background: var(--surface-3); color: var(--ink); }
      .fb-members { list-style: none; margin: 0 -6px; padding: 0; display: flex; flex-direction: column; }
      .fb-member { display: flex; align-items: center; gap: 12px; padding: 8px 6px; border-radius: 12px; }
      .fb-member:hover { background: var(--surface-2); }
      .fb-member img { width: 30px; height: 30px; border-radius: 50%; object-fit: cover; flex: none; }
      .fb-member .fb-who { flex: 1; min-width: 0; display: flex; flex-direction: column; }
      .fb-member .fb-who span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .fb-member .fb-sub { font-size: 12.5px; color: var(--muted); }
      .fb-tag { font-family: var(--font-mono); font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: var(--faint); }
      .fb-section { border-top: 1px solid var(--line); padding-top: 18px; display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
    `;
    document.head.appendChild(st);
  }
  function setMsg(text, err) { const m = $("fb-msg"); if (m) { m.textContent = text; m.classList.toggle("err", !!err); } }
  function hideGate() { const g = $("fb-gate"); if (g) g.remove(); }
  function showGate(kind) {
    injectCss();
    let g = $("fb-gate");
    if (!g) { g = document.createElement("div"); g.id = "fb-gate"; document.body.appendChild(g); }
    if (kind === "offline") {
      g.innerHTML = `<div class="fb-card" role="dialog" aria-labelledby="fb-title">
        <span class="label">${esc(LIST_NAME)}</span>
        <h2 id="fb-title">Couldn't open your list</h2>
        <p>Check your connection, then try again.</p>
        <button type="button" class="btn primary fb-wide" id="fb-retry">Try again</button>
        <button type="button" class="btn ghost fb-wide" id="fb-switch">Use a different account</button>
      </div>`;
      $("fb-retry").onclick = () => location.reload();
      $("fb-switch").onclick = () => S.F.signOut(S.auth).then(() => location.reload());
      return;
    }
    if (kind === "denied") {
      const who = S.user.email || "this account";
      g.innerHTML = `<div class="fb-card" role="dialog" aria-labelledby="fb-title">
        <span class="label">${esc(LIST_NAME)}</span>
        <h2 id="fb-title">You're not on this list yet</h2>
        <p>You're signed in as <b>${esc(who)}</b>. Ask the person who sent you the link to add you under People, then reload this page.</p>
        <button type="button" class="btn fb-wide" id="fb-switch">Use a different account</button>
      </div>`;
      $("fb-switch").onclick = () => S.F.signOut(S.auth).then(() => location.reload());
      return;
    }
    if (kind === "verify") {
      const email = S.user.email;
      g.innerHTML = `<div class="fb-card" role="dialog" aria-labelledby="fb-title">
        <span class="label">${esc(LIST_NAME)}</span>
        <h2 id="fb-title">Check your email</h2>
        <p>We sent a link to <b>${esc(email)}</b>. Open it to confirm it's you, then come back here.</p>
        <button type="button" class="btn primary fb-wide" id="fb-verified">I've confirmed my email</button>
        <button type="button" class="btn fb-wide" id="fb-resend">Send the email again</button>
        <p class="fb-hint" id="fb-msg" role="status">Can't find it? Check your spam or junk folder.</p>
        <div class="fb-links"><button type="button" class="fb-link" id="fb-switch">Use a different account</button></div>
      </div>`;
      $("fb-verified").onclick = () => checkVerified(true);
      $("fb-resend").onclick = async () => {
        $("fb-resend").disabled = true;
        try { await sendVerify(S.user); setMsg(`Sent again to ${email}.`); }
        catch (e) { setMsg(e && e.code === "auth/too-many-requests" ? "We just sent one. Wait a minute, then try again." : friendly(e), true); }
        $("fb-resend").disabled = false;
      };
      $("fb-switch").onclick = () => S.F.signOut(S.auth).then(() => location.reload());
      return;
    }
    g.innerHTML = `<div class="fb-card" role="dialog" aria-labelledby="fb-title">
      <span class="label">${esc(LIST_NAME)}</span>
      <h2 id="fb-title">Sign in to open your list</h2>
      <p>Only people added to this list can see it.</p>
      <button type="button" class="btn fb-wide fb-social" id="fb-google">${G_ICON} Continue with Google</button>
      <div class="fb-or">or</div>
      <form class="fb-stack" id="fb-email-form" autocomplete="on" novalidate>
        <input class="fb-input" id="fb-email" type="email" autocomplete="email" inputmode="email" placeholder="Email" aria-label="Email">
        <input class="fb-input" id="fb-pass" type="password" autocomplete="current-password" placeholder="Password" aria-label="Password">
        <div class="fb-row">
          <button type="submit" class="btn primary" id="fb-signin">Sign in</button>
          <button type="button" class="btn" id="fb-create">Create account</button>
        </div>
      </form>
      <p class="fb-hint" id="fb-msg" role="status">${EMAIL_HINT}</p>
      <div class="fb-links"><button type="button" class="fb-link" id="fb-forgot">Forgot password?</button></div>
    </div>`;
    const { F } = S;
    const popup = async (provider, name) => {
      setMsg(`Opening ${name}…`);
      try { await F.signInWithPopup(S.auth, provider); }
      catch (e) {
        // A redirect fallback can loop on Safari (the sign-in page lives on a different domain), so explain instead.
        if (e && (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment")) setMsg(`Your browser blocked the ${name} sign-in window. Allow pop-ups for this site and try again, or open the link in Safari or Chrome.`, true);
        else setMsg(friendly(e), true);
      }
    };
    $("fb-google").onclick = () => popup(new F.GoogleAuthProvider(), "Google");

    const readEmail = () => {
      const email = $("fb-email").value.trim(), pass = $("fb-pass").value;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setMsg(email ? "That email doesn't look right." : "Enter your email first.", true); $("fb-email").focus(); return null; }
      return { email, pass };
    };
    const busy = (on) => { for (const id of ["fb-signin", "fb-create"]) $(id).disabled = on; };
    $("fb-email-form").onsubmit = async (ev) => {
      ev.preventDefault();
      const v = readEmail(); if (!v) return;
      if (!v.pass) { setMsg("Enter your password.", true); $("fb-pass").focus(); return; }
      busy(true); setMsg("Signing in…");
      try { await F.signInWithEmailAndPassword(S.auth, v.email, v.pass); }
      catch (e) { setMsg(friendly(e), true); busy(false); }
    };
    $("fb-create").onclick = async () => {
      const v = readEmail(); if (!v) return;
      if (v.pass.length < 6) { setMsg("Choose a password with at least 6 characters, then tap Create account.", true); $("fb-pass").focus(); return; }
      busy(true); setMsg("Creating your account…");
      try {
        const cred = await F.createUserWithEmailAndPassword(S.auth, v.email, v.pass);
        try { await sendVerify(cred.user); } catch (e) { setMsg("Your account is ready, but the email didn't send. Tap Send the email again.", true); }
      } catch (e) { setMsg(friendly(e), true); busy(false); }
    };
    $("fb-forgot").onclick = async () => {
      const email = $("fb-email").value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setMsg("Enter your email above, then tap Forgot password.", true); $("fb-email").focus(); return; }
      setMsg("Sending…");
      try { await F.sendPasswordResetEmail(S.auth, email); setMsg(`If there's an account for ${email}, we've sent it a link to choose a new password.`); }
      catch (e) { setMsg(friendly(e), true); }
    };
  }

  /* ---------- confirming an email ---------- */
  async function sendVerify(user) {
    // The link in the email brings people back to this list; without it they land on Firebase's own page.
    try { await S.F.sendEmailVerification(user, { url: location.href }); }
    catch (e) {
      if (e && /continue-uri|unauthorized-domain/.test(e.code || "")) await S.F.sendEmailVerification(user);
      else throw e;
    }
  }
  async function checkVerified(fromButton) {
    const user = S.auth && S.auth.currentUser;
    if (!user || S.ready || !$("fb-verified")) return;
    try { await user.reload(); } catch (e) { if (fromButton) setMsg(friendly(e), true); return; }
    if (!user.emailVerified) { if (fromButton) setMsg("It isn't confirmed yet. Open the link in the email first, then tap the button again.", true); return; }
    try { await user.getIdToken(true); } catch {}
    onUser(user);
  }
  // Confirming usually happens in another tab or the mail app, so look again when people come back.
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") checkVerified(false); });

  /* ---------- people panel ---------- */
  function addPeopleButton() {
    const pct = $("pct");
    if (!pct || $("fb-people-btn")) return;
    const wrapEl = document.createElement("span"); wrapEl.className = "fb-right";
    pct.replaceWith(wrapEl);
    const btn = document.createElement("button");
    btn.type = "button"; btn.id = "fb-people-btn"; btn.className = "label fb-people-btn"; btn.textContent = "People";
    btn.onclick = openPeople;
    wrapEl.append(pct, btn);
  }
  function personFor(kind, value) { for (const [uid, p] of Object.entries(S.people)) if ((kind === "email" ? p.email : p.phone) === value) return [uid, p]; return null; }
  function memberRow(kind, value) {
    const found = personFor(kind, value);
    const me = kind === "email" ? value === myEmail() : value === myPhone();
    const name = found && found[1].name;
    const img = found ? avatarFor(found[0]) : initialsAvatar(kind === "email" ? value : value.slice(-2), colorFor(value));
    return `<li class="fb-member"><img src="${esc(img)}" alt="">
      <span class="fb-who"><span>${esc(name || value)}</span>${name ? `<span class="fb-sub">${esc(value)}</span>` : found ? "" : `<span class="fb-sub">Hasn't signed in yet</span>`}</span>
      ${me ? `<span class="fb-tag">You</span>` : `<button type="button" class="icon-btn sm danger" data-fb-remove="${esc(kind)}:${esc(value)}" aria-label="Remove ${esc(value)}"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg></button>`}
    </li>`;
  }
  function renderPeople() {
    const list = $("fb-members"); if (!list) return;
    const m = S.members;
    list.innerHTML = (m.emails || []).map((e) => memberRow("email", e)).join("") + (m.phones || []).map((p) => memberRow("phone", p)).join("");
  }
  function closePeople() { const el = $("fb-people"); if (el) el.remove(); document.removeEventListener("keydown", onPeopleKey); $("fb-people-btn") && $("fb-people-btn").focus(); }
  function onPeopleKey(ev) { if (ev.key === "Escape") closePeople(); }
  function openPeople() {
    injectCss();
    const me = S.user.email || S.user.phoneNumber || "";
    const el = document.createElement("div");
    el.id = "fb-people"; el.className = "scrim";
    el.innerHTML = `<div class="sheet narrow" role="dialog" aria-modal="true" aria-labelledby="fb-people-title" tabindex="-1">
      <div class="grab" aria-hidden="true"></div>
      <header class="sheet-head tall">
        <div><h2 class="dlg-title" id="fb-people-title">People</h2><p class="dlg-sub">Everyone here can open and edit this list. Add someone by the email they sign in with, then send them the link.</p></div>
        <button type="button" class="icon-btn" data-fb-close aria-label="Close"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg></button>
      </header>
      <div class="sheet-body">
        <ul class="fb-members" id="fb-members"></ul>
        <form class="step-add" id="fb-add" autocomplete="off" novalidate>
          <input id="fb-add-input" maxlength="120" type="email" inputmode="email" placeholder="friend@gmail.com" aria-label="Email to add">
          <button type="submit" class="btn sm ghost">Add</button>
        </form>
        <p class="fb-hint" id="fb-add-msg" role="status"></p>
        <div class="fb-section">
          <span class="label">Bring over a list</span>
          <p class="dlg-sub">Import a list file, like the one saved from your claude.ai list. Its activities are added to this list.</p>
          <label class="btn sm">Choose file<input type="file" id="fb-import" accept=".json,application/json" hidden></label>
        </div>
      </div>
      <footer class="sheet-foot"><span>Signed in as ${esc(me)}</span><button type="button" class="btn sm ghost" data-fb-signout>Sign out</button></footer>
    </div>`;
    document.body.appendChild(el);
    renderPeople();
    requestAnimationFrame(() => el.classList.add("open"));
    el.querySelector(".sheet").focus();
    document.addEventListener("keydown", onPeopleKey);
    const msg = (t, err) => { const m = $("fb-add-msg"); m.textContent = t; m.classList.toggle("err", !!err); };
    el.addEventListener("click", async (ev) => {
      if (ev.target === el || ev.target.closest("[data-fb-close]")) { closePeople(); return; }
      if (ev.target.closest("[data-fb-signout]")) { await S.F.signOut(S.auth); location.reload(); return; }
      const rm = ev.target.closest("[data-fb-remove]");
      if (rm) {
        const [kind, ...rest] = rm.dataset.fbRemove.split(":"); const value = rest.join(":");
        try { await S.F.updateDoc(S.listRef, { [kind === "email" ? "emails" : "phones"]: S.F.arrayRemove(value) }); msg(`Removed ${value}.`); }
        catch (e) { msg("Couldn't remove them. Try again.", true); }
      }
    });
    $("fb-add").onsubmit = async (ev) => {
      ev.preventDefault();
      const value = $("fb-add-input").value.trim().toLowerCase(); if (!value) return;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) { msg("Enter the email they sign in with, like friend@gmail.com.", true); return; }
      try {
        await S.F.updateDoc(S.listRef, { emails: S.F.arrayUnion(value) });
        $("fb-add-input").value = "";
        msg(`Added ${value}. Send them the link and they can sign in.`);
      } catch (e) { msg("Couldn't add them. Try again.", true); }
    };
    $("fb-import").onchange = async (ev) => {
      const file = ev.target.files && ev.target.files[0]; if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        const rows = [];
        let n = 0, k = 0, skipped = 0;
        for (const coll of ["categories", "activities"]) {
          for (const row of data[coll] || []) {
            const ok = row && typeof row.id === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(row.id) && row.data && typeof row.data === "object" && !Array.isArray(row.data) && Object.keys(row.data).length <= 40;
            if (!ok) { skipped++; continue; }
            rows.push([coll, row]);
            coll === "activities" ? n++ : k++;
          }
        }
        // Firestore takes at most 500 writes per batch.
        for (let i = 0; i < rows.length; i += 400) {
          const batch = S.F.writeBatch(S.db);
          rows.slice(i, i + 400).forEach(([coll, row]) => batch.set(S.F.doc(S.db, "lists", listId, coll, row.id), row.data));
          await batch.commit();
        }
        msg(`Imported ${n} ${n === 1 ? "activity" : "activities"} and ${k} ${k === 1 ? "category" : "categories"}.${skipped ? ` Skipped ${skipped} that didn't look right.` : ""}`);
      } catch (e) { msg("That file couldn't be imported. Pick the .json list file.", true); }
      ev.target.value = "";
    };
  }

  window.__bucketlistTest = { flatten };
})();
