/**
 * SkillGalaxy — auth.js
 * Handles all Supabase authentication: sign up, sign in, sign out,
 * session management, and UI state binding.
 */

/* ── SUPABASE CLIENT ─────────────────────────────── */
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

/* ── SESSION STATE ───────────────────────────────── */
let currentUser = null;
let currentSession = null;

/* Called on every page load and auth state change */
sb.auth.onAuthStateChange(async (event, session) => {
  currentSession = session;
  currentUser   = session?.user ?? null;
  updateNavUI();

  if (event === 'SIGNED_IN') {
    closeAuthModal();
    showToast(`Welcome back, ${getUserName(currentUser)} 👋`);
    if (window.__afterLogin) { window.__afterLogin(); window.__afterLogin = null; }
    await refreshCommunitySkills();
  }

  if (event === 'SIGNED_OUT') {
    showToast('Signed out successfully');
    await refreshCommunitySkills();
  }

  if (event === 'PASSWORD_RECOVERY') {
    openAuthModal('reset');
  }
});

/* Initialise — restore session from storage */
async function initAuth() {
  const { data } = await sb.auth.getSession();
  currentSession = data.session;
  currentUser    = data.session?.user ?? null;
  updateNavUI();
}

/* ── HELPERS ─────────────────────────────────────── */
function getUserName(user) {
  if (!user) return 'Guest';
  return user.user_metadata?.username
      || user.email.split('@')[0]
      || 'User';
}

function isLoggedIn() { return !!currentUser; }

/* ── NAV UI ──────────────────────────────────────── */
function updateNavUI() {
  const btnLogin  = document.getElementById('btnLogin');
  const btnLogout = document.getElementById('btnLogout');
  const userChip  = document.getElementById('userChip');
  const userName  = document.getElementById('userName');
  const submitBtn = document.getElementById('btnSubmitNav');

  if (currentUser) {
    btnLogin?.classList.add('hidden');
    btnLogout?.classList.remove('hidden');
    userChip?.classList.remove('hidden');
    submitBtn?.classList.remove('hidden');
    if (userName) userName.textContent = getUserName(currentUser);
  } else {
    btnLogin?.classList.remove('hidden');
    btnLogout?.classList.add('hidden');
    userChip?.classList.add('hidden');
    submitBtn?.classList.add('hidden');
  }
}

/* ── AUTH MODAL ──────────────────────────────────── */
let authMode = 'login'; // 'login' | 'signup' | 'reset'

function openAuthModal(mode = 'login') {
  authMode = mode;
  renderAuthForm();
  document.getElementById('authOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('authEmail')?.focus(), 100);
}

function closeAuthModal() {
  document.getElementById('authOverlay').classList.remove('open');
  document.body.style.overflow = '';
  clearAuthError();
}

function renderAuthForm() {
  const title  = document.getElementById('authTitle');
  const sub    = document.getElementById('authSubtitle');
  const pwWrap = document.getElementById('authPwWrap');
  const btn    = document.getElementById('authSubmitBtn');
  const switchEl = document.getElementById('authSwitch');

  if (authMode === 'login') {
    title.textContent    = 'Welcome back';
    sub.textContent      = 'Sign in to your SkillGalaxy account';
    pwWrap.style.display = 'block';
    btn.textContent      = 'Sign In';
    switchEl.innerHTML   = `No account? <button onclick="switchAuthMode('signup')">Create one</button> · <button onclick="switchAuthMode('reset')">Forgot password?</button>`;
  } else if (authMode === 'signup') {
    title.textContent    = 'Join SkillGalaxy';
    sub.textContent      = 'Create your free account to share skills';
    pwWrap.style.display = 'block';
    btn.textContent      = 'Create Account';
    switchEl.innerHTML   = `Already have one? <button onclick="switchAuthMode('login')">Sign in</button>`;
  } else {
    title.textContent    = 'Reset Password';
    sub.textContent      = 'Enter your email and we\'ll send a reset link';
    pwWrap.style.display = 'none';
    btn.textContent      = 'Send Reset Link';
    switchEl.innerHTML   = `Remembered it? <button onclick="switchAuthMode('login')">Sign in</button>`;
  }
}

function switchAuthMode(mode) {
  authMode = mode;
  renderAuthForm();
  clearAuthError();
}

function setAuthError(msg) {
  const el = document.getElementById('authError');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function clearAuthError() {
  const el = document.getElementById('authError');
  if (el) { el.textContent = ''; el.style.display = 'none'; }
}

function setAuthLoading(loading) {
  const btn = document.getElementById('authSubmitBtn');
  if (!btn) return;
  btn.disabled    = loading;
  btn.textContent = loading
    ? (authMode === 'reset' ? 'Sending…' : authMode === 'signup' ? 'Creating…' : 'Signing in…')
    : (authMode === 'reset' ? 'Send Reset Link' : authMode === 'signup' ? 'Create Account' : 'Sign In');
}

/* ── AUTH ACTIONS ────────────────────────────────── */
async function handleAuthSubmit() {
  clearAuthError();
  const email = document.getElementById('authEmail')?.value?.trim();
  const pw    = document.getElementById('authPassword')?.value;

  if (!email || !email.includes('@')) { setAuthError('Enter a valid email address'); return; }

  if (authMode === 'reset') {
    setAuthLoading(true);
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: `${SITE_URL}/?reset=true`
    });
    setAuthLoading(false);
    if (error) { setAuthError(error.message); return; }
    showToast('Reset link sent — check your email 📧');
    closeAuthModal();
    return;
  }

  if (!pw || pw.length < 6) { setAuthError('Password must be at least 6 characters'); return; }

  setAuthLoading(true);

  if (authMode === 'signup') {
    const { error } = await sb.auth.signUp({ email, password: pw,
      options: { data: { username: email.split('@')[0] } }
    });
    setAuthLoading(false);
    if (error) { setAuthError(error.message); return; }
    showToast('Account created! Check your email to confirm 📧');
    closeAuthModal();
  } else {
    const { error } = await sb.auth.signInWithPassword({ email, password: pw });
    setAuthLoading(false);
    if (error) {
      if (error.message.includes('Invalid login')) {
        setAuthError('Wrong email or password');
      } else {
        setAuthError(error.message);
      }
      return;
    }
    // onAuthStateChange fires automatically
  }
}

async function handleSignOut() {
  await sb.auth.signOut();
}

/* Require login gate — shows modal if not logged in */
function requireLogin(callback) {
  if (isLoggedIn()) { callback(); return; }
  window.__afterLogin = callback;
  openAuthModal('login');
}

/* ── PASSWORD RESET HANDLING ─────────────────────── */
async function handlePasswordReset() {
  const newPw = document.getElementById('newPassword')?.value;
  if (!newPw || newPw.length < 6) { setResetError('Password must be at least 6 characters'); return; }
  const { error } = await sb.auth.updateUser({ password: newPw });
  if (error) { setResetError(error.message); return; }
  showToast('Password updated! You are now signed in.');
  document.getElementById('resetOverlay')?.classList.remove('open');
}

function setResetError(msg) {
  const el = document.getElementById('resetError');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

/* Check if page loaded from password reset email */
function checkResetFlow() {
  const hash = window.location.hash;
  if (hash.includes('type=recovery') || window.location.search.includes('reset=true')) {
    document.getElementById('resetOverlay')?.classList.add('open');
  }
}
