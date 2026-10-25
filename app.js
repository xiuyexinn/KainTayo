/* KainTayo – Production full-stack app logic connected to real backend API */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* Comment icon */
const CM_ICON = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16.5 1.853c-8.133 0-14.75 5.663-14.75 12.624 0.045 2.863 1.132 5.465 2.896 7.45l-0.010-0.012c-0.608 2.418-1.844 4.491-3.525 6.104l-0.004 0.004c-0.22 0.225-0.355 0.534-0.355 0.873 0 0.691 0.56 1.252 1.252 1.252 0.089 0 0.175-0.009 0.259-0.027l-0.008 0.001c3.458-0.576 6.524-1.93 9.121-3.877l-0.054 0.039c1.547 0.517 3.328 0.816 5.179 0.817h0c8.133 0 14.75-5.664 14.75-12.625s-6.617-12.624-14.75-12.624zM16.5 24.602c-0.015 0-0.034 0-0.052 0-1.77 0-3.465-0.321-5.030-0.908l0.099 0.032c-0.045-0.011-0.1-0.020-0.155-0.025l-0.005-0c-0.085-0.025-0.182-0.041-0.283-0.045l-0.002-0c-0.074 0.005-0.142 0.016-0.207 0.033l0.008-0.002c-0.1 0.013-0.19 0.035-0.275 0.068l0.008-0.003c-0.079 0.039-0.146 0.081-0.209 0.129l0.003-0.002c-0.064 0.033-0.118 0.067-0.169 0.105l0.003-0.002c-1.371 1.186-3 2.115-4.789 2.69l-0.098 0.027c0.896-1.391 1.555-3.025 1.872-4.778l0.012-0.082c0.005-0.031-0.005-0.060-0.002-0.092 0.002-0.028 0.003-0.060 0.003-0.093 0-0.311-0.107-0.597-0.286-0.824l0.002 0.003c-0.019-0.023-0.025-0.051-0.046-0.073-1.617-1.608-2.626-3.826-2.652-6.28l-0-0.005c0-5.582 5.495-10.124 12.25-10.124s12.25 4.542 12.25 10.124-5.496 10.125-12.25 10.125z"/></svg>';
/* Bookmark icon (outline; CSS fills it when saved) */
const BM_ICON = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15.75 5H8.25C7.55964 5 7 5.58763 7 6.3125V19L12 15.5L17 19V6.3125C17 5.58763 16.4404 5 15.75 5Z" stroke="#188b20" stroke-width="1.032" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const QUICK = ['Rice','Garlic','Egg','Onion','Tomato','Pork','Chicken'];

/* ---------- State (Only token is stored in localStorage) ---------- */
let state = {
  token: localStorage.getItem('kt_token') || null,
  user: null,
  recipes: [],
  recipeDetails: {},
  bookmarks: [],
  savedRecipes: [],
  posts: [],
  comments: {},
  openC: [],
  ings: [],
  cat: 'All',
  view: 'find',
  mode: 'login',
  photo: null,
  activeRecipeId: null
};

/* ---------- API Client ---------- */
async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }
  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }
  options.headers = headers;

  try {
    const res = await fetch(path, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401 && state.token) {
        // Session expired or invalid
        localStorage.removeItem('kt_token');
        state.token = null;
        state.user = null;
        state.bookmarks = [];
        renderSide();
      }
      throw new Error(data.error || 'Request failed');
    }
    return data;
  } catch (err) {
    throw err;
  }
}

/* ---------- UI helpers ---------- */
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}
const openModal = id => {
  $(id).hidden = false;
  $(id).querySelector('input')?.focus();
};
const closeModals = () => $$('.modal').forEach(m => m.hidden = true);

/* ---------- Navigation ---------- */
async function go(view) {
  if (view === 'profile' && !state.user) {
    return askLogin('Log in to see your profile.');
  }
  state.view = view;
  $$('[data-view]').forEach(s => s.hidden = s.dataset.view !== view);
  $$('[data-nav]').forEach(b => b.classList.toggle('active', b.dataset.nav === view));
  if (innerWidth <= 900) closeDrawer();
  window.scrollTo(0, 0);

  if (view === 'find') await loadRecipes();
  if (view === 'community') await loadFeed();
  if (view === 'profile') await loadProfile();
}

const closeDrawer = () => {
  $('#sidebar').classList.remove('open');
  $('#scrim').classList.remove('open');
};

function askLogin(msg) {
  setMode('login');
  if (msg) toast(msg);
  openModal('#authModal');
}

/* ---------- Sidebar footer ---------- */
function renderSide() {
  const f = $('#sideFoot');
  f.innerHTML = state.user
    ? `<button class="user" data-nav="profile"><span class="avatar">${esc(state.user.name[0].toUpperCase())}</span><span><b>${esc(state.user.name)}</b><small>View profile</small></span></button>`
    : `<button class="btn green" id="loginBtn">Login</button>`;
  $('#loginBtn')?.addEventListener('click', () => askLogin());
  $('.user', f)?.addEventListener('click', () => go('profile'));
  renderGreeting();
}

/* ---------- Greeting ---------- */
function renderGreeting() {
  const h = new Date().getHours();
  const g = h < 11 ? 'umaga' : h < 13 ? 'tanghali' : h < 18 ? 'hapon' : 'gabi';
  $('#greeting').textContent = `Magandang ${g}${state.user ? ', ' + state.user.name : ''}!`;
}

/* ---------- Recipes ---------- */
function recipeCard(r) {
  const on = state.bookmarks.includes(r.id);
  const hit = (r.ing || []).filter(i => state.ings.includes(i.toLowerCase())).length;
  return `<article class="card" data-id="${r.id}" tabindex="0"><div class="thumb" style="background:linear-gradient(135deg,${r.c},${r.c}99)">${r.e}
    <button class="save ${on ? 'on' : ''}" data-save="${r.id}" aria-label="Bookmark ${esc(r.name)}" aria-pressed="${on}">${BM_ICON}</button></div>
    <div class="c-body"><div class="local">${esc(r.local)}</div><h3>${esc(r.name)}</h3>
    <div class="meta"><span>⏱ ${r.time} min</span><span>🔥 ${r.kcal} kcal</span></div>
    ${state.ings.length ? `<div class="match">${hit}/${(r.ing || []).length} ingredients matched</div>` : ''}</div></article>`;
}

async function loadRecipes() {
  try {
    const params = new URLSearchParams();
    if (state.ings.length) {
      params.set('ings', state.ings.join(','));
    }
    if (state.cat && state.cat !== 'All') {
      params.set('cat', state.cat);
    }
    const qs = params.toString();
    const data = await api(`/api/recipes${qs ? '?' + qs : ''}`);
    state.recipes = data;
    data.forEach(r => { state.recipeDetails[r.id] = r; });
    renderRecipes();
  } catch (err) {
    console.error('Failed to load recipes:', err);
  }
}

function renderRecipes() {
  const q = state.ings;
  const list = state.recipes;
  $('#recipeGrid').innerHTML = list.length
    ? list.map(recipeCard).join('')
    : `<div class="empty"><div>🍳</div><b>Walang nahanap na ulam.</b>Try removing an ingredient or switching the category.</div>`;
  $('#resultSub').textContent = q.length
    ? 'Based on your ingredients: ' + q.map(i => i[0].toUpperCase() + i.slice(1)).join(', ')
    : 'Sorted by best match to your ingredients.';
  $('#added').innerHTML = q.map(i => `<button class="chip on" data-rm="${i}">${i[0].toUpperCase() + i.slice(1)} ✕</button>`).join('');
  $('#addedRow').hidden = !q.length;
}

function addIng(v) {
  v = v.trim().toLowerCase();
  if (v && !state.ings.includes(v)) {
    state.ings.push(v);
    $('#ingInput').value = '';
    loadRecipes();
  }
}

async function toggleBookmark(id) {
  if (!state.user) return askLogin('Log in to bookmark recipes.');
  try {
    const res = await api(`/api/bookmarks/${id}`, { method: 'POST' });
    state.bookmarks = res.bookmarks;
    const r = state.recipeDetails[id] || state.recipes.find(x => x.id === id);
    const recipeName = r ? r.name : 'Recipe';
    if (res.bookmarked) {
      toast(`Naka-save na ang ${recipeName}! Makikita sa Profile mo.`);
    } else {
      toast(`Inalis na ang ${recipeName} sa bookmarks.`);
    }
    renderRecipes();
    if (state.view === 'profile') await loadProfile();
    if (!$('#recipeModal').hidden && state.activeRecipeId === id) {
      openRecipe(id);
    }
  } catch (err) {
    toast(err.message || 'Failed to update bookmark');
  }
}

/* ---------- Recipe detail ---------- */
async function openRecipe(id) {
  state.activeRecipeId = id;
  let r = state.recipeDetails[id];
  if (!r || !r.items) {
    try {
      r = await api(`/api/recipes/${id}`);
      state.recipeDetails[id] = r;
    } catch {
      toast('Failed to load recipe details');
      return;
    }
  }
  const on = state.bookmarks.includes(id);
  const items = (r.items || []).map(t => {
    const have = state.ings.some(i => t.toLowerCase().includes(i));
    return `<li class="${have ? 'have' : ''}">${have ? '✓ ' : ''}${esc(t)}</li>`;
  }).join('');

  $('#rDialog').innerHTML = `<div class="r-hero" style="background:linear-gradient(135deg,${r.c},${r.c}99)">${r.e}
    <button class="x" data-close aria-label="Close">✕</button></div>
    <div class="r-body"><div class="local">${esc(r.local)}</div><h2 class="h" id="rTitle">${esc(r.name)}</h2><p class="r-desc">${esc(r.desc || '')}</p>
    <div class="meta big"><span>⏱ ${r.time} min</span><span>🍽 Serves ${r.serves || 4}</span><span>🔥 ${r.kcal} kcal</span></div>
    <div class="r-cols"><section><h3>Ingredients</h3><ul class="ing-list">${items}</ul></section>
    <section><h3>Instructions</h3><ol class="steps">${(r.steps || []).map(s => `<li>${esc(s)}</li>`).join('')}</ol></section></div>
    <button class="btn ${on ? 'gold' : 'orange'} full" data-save="${id}" style="margin-top:18px">${on ? 'Remove from bookmarks' : 'Save recipe'}</button></div>`;
  openModal('#recipeModal');
}

/* ---------- Community ---------- */
const timeAgo = ts => {
  if (!ts) return 'Just now';
  const m = Math.floor((Date.now() - ts) / 60000);
  return m < 1 ? 'Just now' : m < 60 ? m + 'm ago' : Math.floor(m / 60) + 'h ago';
};

async function loadFeed() {
  try {
    const posts = await api('/api/posts');
    state.posts = posts;
    renderFeed();
  } catch (err) {
    console.error('Failed to load feed:', err);
  }
}

function renderFeed() {
  $('#feed').innerHTML = state.posts.map(p => {
    const liked = Boolean(p.liked);
    const n = p.likes;
    const img = p.photo ? `background-image:url(${p.photo})` : `background:linear-gradient(135deg,${p.c || '#c9902a'},${p.c || '#c9902a'}aa)`;
    return `<article class="post"><div class="post-h"><span class="avatar" style="background:${p.color || 'var(--orange)'}">${esc((p.user || 'K')[0].toUpperCase())}</span>
      <div><b>${esc(p.user)}</b><small>📍 ${esc(p.region)}</small></div><time>${p.createdAt ? timeAgo(p.createdAt) : (p.time || 'Recently')}</time></div>
      <span class="dish">${esc(p.dish)}</span><div class="post-img" style="${img}">${p.photo ? '' : (p.e || '🍲')}</div><p>${esc(p.text)}</p>
      <div class="acts"><button class="${liked ? 'liked' : ''}" data-like="${p.id}">${liked ? '♥' : '♡'} ${n}</button><button data-comments="${p.id}" aria-expanded="${state.openC.includes(p.id)}">${CM_ICON} ${p.comments || 0}</button>
      <button class="sp" data-sharepost="${esc(p.dish)}">↗ Share</button></div>${state.openC.includes(p.id) ? commentsHTML(p.id) : ''}</article>`;
  }).join('');
}

function commentsHTML(id) {
  const list = state.comments[id] || [];
  const rows = list.length
    ? list.map(c => `<li class="cm"><span class="avatar">${esc((c.user || 'K')[0].toUpperCase())}</span><div><b>${esc(c.user)}</b><small>${timeAgo(c.createdAt)}</small><p>${esc(c.text)}</p></div></li>`).join('')
    : '<li class="c-empty">Wala pang comments. Be the first!</li>';
  return `<div class="comments"><ul>${rows}</ul><form class="c-form" data-cform="${id}"><input placeholder="Magdagdag ng comment…" maxlength="300" aria-label="Write a comment"><button class="btn orange">Send</button></form></div>`;
}

async function toggleComments(id) {
  if (state.openC.includes(id)) {
    state.openC = state.openC.filter(x => x !== id);
    renderFeed();
  } else {
    state.openC.push(id);
    try {
      const comments = await api(`/api/posts/${id}/comments`);
      state.comments[id] = comments;
      renderFeed();
    } catch {
      renderFeed();
    }
  }
}

async function addComment(id, text) {
  if (!state.user) return askLogin('Log in to comment.');
  text = text.trim();
  if (!text) return;
  try {
    const res = await api(`/api/posts/${id}/comments`, {
      method: 'POST',
      body: { text }
    });
    if (!state.comments[id]) state.comments[id] = [];
    state.comments[id].push(res.comment);
    const post = state.posts.find(p => p.id === id);
    if (post) post.comments = res.commentsCount;
    renderFeed();
    $(`[data-cform="${id}"] input`)?.focus();
  } catch (err) {
    toast(err.message || 'Failed to post comment');
  }
}

async function like(id) {
  if (!state.user) return askLogin('Log in to like posts.');
  try {
    const res = await api(`/api/posts/${id}/like`, { method: 'POST' });
    const post = state.posts.find(p => p.id === id);
    if (post) {
      post.liked = res.liked;
      post.likes = res.likesCount;
    }
    renderFeed();
  } catch (err) {
    toast(err.message || 'Failed to update like');
  }
}

async function submitPost(e) {
  e.preventDefault();
  if (!state.user) return askLogin('Log in to share a recipe.');
  const name = $('#sName').value.trim();
  const region = $('#sRegion').value.trim();
  const time = $('#sTime').value.trim();
  const desc = $('#sDesc').value.trim();
  if (!name || !region || !desc) {
    $('#shareErr').textContent = 'Add a recipe name, region, and description.';
    return;
  }

  try {
    const res = await api('/api/posts', {
      method: 'POST',
      body: {
        dish: name,
        region,
        time: time || '40 min',
        text: desc,
        photo: state.photo
      }
    });

    state.posts.unshift(res.post);
    e.target.reset();
    state.photo = null;
    resetDrop();
    $('#shareErr').textContent = '';
    closeModals();
    renderFeed();
    toast('Naipost na ang recipe mo!');
  } catch (err) {
    $('#shareErr').textContent = err.message || 'Failed to publish post.';
  }
}

function resetDrop() {
  $('#drop').classList.remove('ok');
  $('#dropIcon').textContent = '📷';
  $('#dropText').textContent = 'Click to add a photo';
}

/* ---------- Profile ---------- */
async function loadProfile() {
  if (!state.user) return;
  try {
    const res = await api('/api/profile');
    $('#pAvatar').textContent = res.user.name[0].toUpperCase();
    $('#pName').textContent = res.user.name;
    $('#pBm').textContent = res.bookmarksCount;
    $('#pSh').textContent = res.sharedCount;
    state.savedRecipes = res.savedRecipes || [];
    renderProfileGrid();
  } catch (err) {
    console.error('Failed to load profile:', err);
  }
}

function renderProfileGrid() {
  const saved = state.savedRecipes;
  $('#bmGrid').innerHTML = saved.length
    ? saved.map(recipeCard).join('')
    : `<div class="empty"><div>📋</div><b>Walang naka-bookmark pa.</b>Bookmark recipes from the <a data-nav="find">Home tab</a>!</div>`;
}

/* ---------- Auth ---------- */
function setMode(m) {
  state.mode = m;
  const su = m === 'signup';
  $$('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === m));
  $('#fUser').hidden = !su;
  $('#authErr').textContent = '';
  $('#authTitle').textContent = su ? 'Tara, KainTayo!' : 'Welcome back!';
  $('#authSub').textContent = su ? 'Create your free account.' : '';
  $('#authSubmit').textContent = su ? 'Create Account' : 'Tuloy na! →';
  $('#authSwap').innerHTML = su ? 'May account na? <a data-mode="login">Mag-login</a>' : 'Wala pang account? <a data-mode="signup">Mag-sign up</a>';
}

async function submitAuth(e) {
  e.preventDefault();
  const email = $('#fEmail').value.trim();
  const pass = $('#fPass').value;
  const uname = $('#fUser').value.trim();
  const err = $('#authErr');

  if (!/^\S+@\S+\.\S+$/.test(email)) return err.textContent = 'Enter a valid email address.';
  if (pass.length < 6) return err.textContent = 'Password must be at least 6 characters.';
  if (state.mode === 'signup' && !uname) return err.textContent = 'Choose a username.';

  try {
    const endpoint = state.mode === 'signup' ? '/api/auth/signup' : '/api/auth/login';
    const payload = state.mode === 'signup'
      ? { username: uname, email, password: pass }
      : { email, password: pass };

    const res = await api(endpoint, {
      method: 'POST',
      body: payload
    });

    state.token = res.token;
    localStorage.setItem('kt_token', res.token);
    state.user = res.user;

    // Load initial user bookmarks
    const bmRes = await api('/api/bookmarks');
    state.bookmarks = bmRes.bookmarks;

    e.target.reset();
    closeModals();
    renderSide();
    await loadRecipes();
    if (state.view === 'community') await loadFeed();
    if (state.view === 'profile') await loadProfile();
    toast(`Magandang araw, ${state.user.name}!`);
  } catch (error) {
    err.textContent = error.message || 'Authentication failed.';
  }
}

function logout() {
  state.user = null;
  state.token = null;
  state.bookmarks = [];
  state.savedRecipes = [];
  localStorage.removeItem('kt_token');
  renderSide();
  go('find');
  toast('Naka-logout ka na.');
}

/* ---------- Events ---------- */
document.addEventListener('click', e => {
  const t = e.target;
  const nav = t.closest('[data-nav]');
  if (nav) go(nav.dataset.nav);

  const sv = t.closest('[data-save]');
  if (sv) toggleBookmark(+sv.dataset.save);

  const cd = t.closest('.card');
  if (cd && !sv) openRecipe(+cd.dataset.id);

  const rm = t.closest('[data-rm]');
  if (rm) {
    state.ings = state.ings.filter(i => i !== rm.dataset.rm);
    loadRecipes();
  }

  const lk = t.closest('[data-like]');
  if (lk) like(lk.dataset.like);

  const cm = t.closest('[data-comments]');
  if (cm) toggleComments(cm.dataset.comments);

  const sp = t.closest('[data-sharepost]');
  if (sp) toast('Link copied: ' + sp.dataset.sharepost);

  const md = t.closest('[data-mode]');
  if (md) setMode(md.dataset.mode);

  const tab = t.closest('[data-tab]');
  if (tab) setMode(tab.dataset.tab);

  if (t.closest('[data-close]') || t.classList.contains('modal')) closeModals();
});

document.addEventListener('submit', e => {
  const f = e.target.closest('[data-cform]');
  if (!f) return;
  e.preventDefault();
  addComment(f.dataset.cform, f.querySelector('input').value);
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModals();
  if (e.key === 'Enter' && e.target.classList?.contains('card')) {
    openRecipe(+e.target.dataset.id);
  }
});

$('#enterApp').onclick = () => {
  $('#landing').hidden = true;
  $('#app').hidden = false;
  loadRecipes();
};

$('#burger').onclick = () => {
  const o = $('#sidebar').classList.toggle('open');
  $('#scrim').classList.toggle('open', o);
};

$('#scrim').onclick = closeDrawer;

$('#ingInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    addIng(e.target.value);
  }
});

$('#searchBtn').onclick = () => {
  if ($('#ingInput').value.trim()) {
    addIng($('#ingInput').value);
  } else {
    loadRecipes();
  }
  $('#recipeGrid').scrollIntoView({ behavior: 'smooth' });
};

$('#quick').innerHTML = QUICK.map(q => `<button class="chip" data-q="${q}">+ ${q}</button>`).join('');
$('#quick').onclick = e => {
  const q = e.target.dataset.q;
  if (q) addIng(q);
};

$('#filters').innerHTML = ['All', 'Breakfast', 'Snacks', 'Lunch', 'Dinner'].map(c => `<button class="${c === 'All' ? 'active' : ''}" data-cat="${c}">${c}</button>`).join('');
$('#filters').onclick = e => {
  const c = e.target.dataset.cat;
  if (!c) return;
  state.cat = c;
  $$('#filters button').forEach(b => b.classList.toggle('active', b.dataset.cat === c));
  loadRecipes();
};

$('#shareBtn').onclick = () => {
  if (!state.user) return askLogin('Log in to share a recipe.');
  openModal('#shareModal');
};

$('#shareForm').onsubmit = submitPost;

$('#sFile').onchange = e => {
  const f = e.target.files[0];
  if (!f) return;
  if (f.size > 10 * 1024 * 1024) {
    $('#shareErr').textContent = 'Photo must be under 10MB.';
    return;
  }
  const rd = new FileReader();
  rd.onload = () => {
    state.photo = rd.result;
    $('#drop').classList.add('ok');
    $('#dropIcon').textContent = '🍲';
    $('#dropText').textContent = f.name + ' attached ✓';
    $('#shareErr').textContent = '';
  };
  rd.readAsDataURL(f);
};

$('#authForm').onsubmit = submitAuth;
$('#logoutBtn').onclick = logout;

/* ---------- Bootstrap Application ---------- */
async function init() {
  setMode('login');
  renderSide();

  // If user token exists in localStorage, validate it with the backend
  if (state.token) {
    try {
      const res = await api('/api/auth/me');
      state.user = res.user;
      $('#landing').hidden = true;
      $('#app').hidden = false;
      renderSide();
      const bmRes = await api('/api/bookmarks');
      state.bookmarks = bmRes.bookmarks;
    } catch {
      state.token = null;
      localStorage.removeItem('kt_token');
    }
  }

  await loadRecipes();
}

init();
