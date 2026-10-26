/* CRM Concejo Deliberante SSJ — front estático. Datos y escrituras: API n8n ("Concejo CRM API") sobre Supabase. */
(() => {
'use strict';
const API = 'https://n8n.consultorarz.com/webhook/concejo-crm-api';
const TZ = 'America/Argentina/Jujuy';
const POLL_MS = 60000;

/* ---------- utilidades ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = new Intl.NumberFormat('es-AR');
const num = (n) => nf.format(Number(n) || 0);
const store = {
  get(k, d = '') { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* sin storage */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* sin storage */ } },
};
const fmt = (d, o) => new Intl.DateTimeFormat('es-AR', { timeZone: TZ, ...o }).format(d);
const dayKey = (d) => fmt(d, { year: 'numeric', month: '2-digit', day: '2-digit' });
const hhmm = (d) => fmt(d, { hour: '2-digit', minute: '2-digit', hour12: false });
function rel(iso) {
  if (!iso) return '—';
  const d = new Date(iso), now = new Date(), min = (now - d) / 60000;
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${Math.floor(min)} min`;
  if (dayKey(d) === dayKey(now)) return `hoy ${hhmm(d)}`;
  if (dayKey(d) === dayKey(new Date(now - 864e5))) return `ayer ${hhmm(d)}`;
  if (min < 7 * 1440) return `${fmt(d, { weekday: 'short' }).replace('.', '')} ${hhmm(d)}`;
  return fmt(d, { day: 'numeric', month: 'short' }).replace('.', '');
}
const longDate = (iso) => { const d = new Date(iso); return `${fmt(d, { day: 'numeric', month: 'long', year: 'numeric' })}, ${hhmm(d)}`; };
function dayLabel(iso) {
  const d = new Date(iso), now = new Date();
  if (dayKey(d) === dayKey(now)) return 'Hoy';
  if (dayKey(d) === dayKey(new Date(now - 864e5))) return 'Ayer';
  return fmt(d, { weekday: 'long', day: 'numeric', month: 'long' });
}
/* "2026-10-23 18:48" (texto en hora Jujuy) → "23 oct 18:48" */
function txtFecha(t) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}:\d{2}))?/.exec(t || '');
  if (!m) return t || '—';
  return `${Number(m[3])} ${MESES[Number(m[2]) - 1].slice(0, 3)}${m[4] ? ' ' + m[4] : ''}`;
}
function phoneFmt(t) {
  t = String(t || '');
  if (/^549\d{10}$/.test(t)) { const r = t.slice(3); return `+54 9 ${r.slice(0, 3)} ${r.slice(3, 6)}-${r.slice(6)}`; }
  return t ? `+${t}` : '';
}
const initials = (r) => {
  const n = (r.nombre || '').replace(/[^\p{L}\s]/gu, '').trim();
  if (n) { const p = n.split(/\s+/); return (p[0][0] + (p[1]?.[0] || '')).toUpperCase(); }
  return '#';
};
const hue = (t) => 1 + (Number(String(t).slice(-3)) % 6);
const ATEN = { no_atendido: 'Sin atender', seguimiento: 'En seguimiento', atendido: 'Atendido' };
const ATEN_CLS = { no_atendido: 'no', seguimiento: 'seg', atendido: 'ok' };

const IC = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8"/>',
  hand: '<path d="M4 12h12M12 6l6 6-6 6"/><path d="M20 5v14"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.5 7 8.5 6 8.5-6"/>',
  scroll: '<path d="M7 3h11a2 2 0 0 1 2 2v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-1h4"/><path d="M7 3a2 2 0 0 0-2 2v11M10 8h6M10 12h6"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-1 1.6-2.1-.4-1.2.3-2.4 1.7-2.4H17a4 4 0 0 0 4-4C21 6.9 17 3 12 3z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10.5" cy="7.5" r="1"/><circle cx="15" cy="7.5" r="1"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/>',
  out: '<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4"/><path d="M10 17l-5-5 5-5M5 12h11"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4 7 7 0 0 0 20 14.5z"/>',
  wa: '<path d="M21 12a8 8 0 0 1-11.7 7L4 20l1.1-4.6A8 8 0 1 1 21 12z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1.2-1.5-2-1-.8.8a3.5 3.5 0 0 1-1.7-1.7l.8-.8-1-2z"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  empty: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 13h5l1.5 3h5L16 13h5"/>',
};
const ico = (n, s = 18) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n]}</svg>`;

/* ---------- estado ---------- */
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const cap = (t) => t[0].toUpperCase() + t.slice(1);
function mesActual() { const d = new Date(Date.now() - 3 * 36e5); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; }
const mesNombre = (m) => { const [y, n] = m.split('-'); return `${MESES[n - 1]} ${y}`; };
const S = {
  view: 'resumen', token: store.get('concejo_tk'), op: store.get('concejo_op'),
  mes: store.get('concejo_mes', null) ?? mesActual(), pruebas: store.get('concejo_pruebas') === '1',
  meses: null, pruebasOcultas: 0, charts: [], seq: 0, openTel: null,
  list: { q: '', filtro: 'todos', page: 0, size: 40, orden: 'recientes' }, rows: new Map(), badges: { vecinos: 0 },
  deFiltro: 'todos',
};
const enPeriodo = () => (S.mes ? `en ${mesNombre(S.mes)}` : 'en total');

/* ---------- API ---------- */
async function api(action, payload = {}, tries = 2) {
  for (let i = 0; i < tries; i++) {
    const ac = new AbortController(), to = setTimeout(() => ac.abort(), 25000);
    try {
      const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ action, token: S.token, ...payload }), signal: ac.signal });
      if (r.status === 401) { lock(); const e = new Error('sesion'); e.auth = true; throw e; }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      if (j && j.error) throw new Error(j.error);
      setLive(true);
      return j;
    } catch (e) {
      if (e.auth) throw e;
      if (i === tries - 1) { setLive(false); throw e; }
      await new Promise((res) => setTimeout(res, 700));
    } finally { clearTimeout(to); }
  }
}
function setLive(ok) { $('#live').classList.toggle('off', !ok); $('#liveTxt').textContent = ok ? 'En vivo' : 'Sin conexión'; }
const per = () => ({ mes: S.mes, pruebas: S.pruebas });

/* ---------- acceso ---------- */
function lock() {
  S.token = ''; store.del('concejo_tk');
  $('#intro').hidden = false; $('#appRoot').hidden = true; $('#tabbar').hidden = true; closeDrawer();
  setTimeout(() => $('#lgUser').focus(), 50);
}
function unlock() { $('#intro').hidden = true; $('#appRoot').hidden = false; $('#tabbar').hidden = false; }
async function doLogin(e) {
  e.preventDefault();
  const u = $('#lgUser').value.trim(), p = $('#lgPass').value;
  if (!u || !p) { $('#lgErr').textContent = 'Escribí usuario y contraseña.'; return; }
  $('#lgBtn').disabled = true; $('#lgErr').textContent = '';
  try {
    const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ action: 'login', usuario: u, clave: p }) });
    const j = await r.json();
    if (!j.token) { $('#lgErr').textContent = 'Usuario o contraseña incorrectos.'; return; }
    S.token = j.token; store.set('concejo_tk', j.token); $('#lgPass').value = '';
    unlock(); route();
  } catch { $('#lgErr').textContent = 'No pudimos conectar. Probá de nuevo en un momento.'; }
  finally { $('#lgBtn').disabled = false; }
}

/* ---------- tema ---------- */
const curTheme = () => document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
function applyTheme(t) {
  if (t) { document.documentElement.dataset.theme = t; store.set('concejo_theme', t); }
  const dark = curTheme() === 'dark';
  $$('#themeBtn,#themeBtnM').forEach((b) => { b.innerHTML = ico(dark ? 'sun' : 'moon', 19); b.title = dark ? 'Pasar a tema claro' : 'Pasar a tema oscuro'; });
  if (S.charts.length) route();
}

/* ---------- navegación ---------- */
const VIEWS = {
  resumen: { t: 'Resumen', s: 'Qué está pasando con las consultas al Asistente', i: 'grid' },
  vecinos: { t: 'Vecinos', s: 'Quienes escribieron al WhatsApp del Concejo', i: 'users' },
  derivaciones: { t: 'Derivados', s: 'Coordinación, mediaciones y audiencias', i: 'hand' },
  buzon: { t: 'Buzón', s: 'Propuestas «Tu norma, tu ciudad»', i: 'mail' },
  ordenanzas: { t: 'Ordenanzas', s: 'Qué ordenanzas consultan los vecinos', i: 'scroll' },
  auditoria: { t: 'Auditoría', s: 'Cómo responde el Asistente y qué se le pregunta', i: 'eye' },
  marca: { t: 'Manual de marca', s: 'Identidad visual del Concejo Deliberante', i: 'palette' },
};
function buildNav() {
  $('#nav').innerHTML = Object.entries(VIEWS).map(([k, v]) => `<a href="#/${k}" data-v="${k}">${ico(v.i, 20)}<span>${esc(v.t)}</span><em class="badge" data-b="${k}" hidden></em></a>`).join('');
  const short = { derivaciones: 'Derivados', ordenanzas: 'Ordenanz.', auditoria: 'Auditoría', marca: 'Marca' };
  $('#tabbar').innerHTML = Object.keys(VIEWS).map((k) => `<a href="#/${k}" data-v="${k}">${ico(VIEWS[k].i, 22)}<span>${esc(short[k] || VIEWS[k].t)}</span><em class="badge" data-b="${k}" hidden></em></a>`).join('');
  $('#refreshBtn').innerHTML = ico('refresh', 20); $('#logoutBtn').innerHTML = ico('out', 19);
}
function paintNav() {
  $$('#nav a,#tabbar a').forEach((a) => { if (a.dataset.v === S.view) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  $$('[data-b]').forEach((e) => { const n = S.badges[e.dataset.b] || 0; e.hidden = !n; e.textContent = n > 99 ? '99+' : n; e.title = n ? `${n} sin atender ${enPeriodo()}` : ''; });
}
function paintOp() {
  const n = S.op;
  $('#opBtn').innerHTML = `<span class="av">${esc(n ? n[0].toUpperCase() : '?')}</span><span><small>Atendiendo</small><b>${esc(n || 'Poné tu nombre')}</b></span>`;
  $('#opBtnM').textContent = n ? n[0].toUpperCase() : '?';
  $('#opBtnM').setAttribute('aria-label', n ? `Atendiendo: ${n}` : 'Poné tu nombre');
}
function openPop(after) {
  const p = $('#opPop'); p.hidden = false; $('#opInput').value = S.op || ''; $('#opInput').focus(); p._after = after || null;
}
function closePop() { $('#opPop').hidden = true; }
function needOp(cb) { if (S.op) return cb(); openPop(cb); return null; }
function toast(t) { const e = $('#toast'); e.textContent = t; e.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => e.classList.remove('show'), 2600); }
function banner(msg, err) { const b = $('#banner'); b.hidden = !msg; b.className = 'banner' + (err ? ' err' : ''); b.textContent = msg || ''; }

/* ---------- barra de periodo ---------- */
function listaMeses() {
  const hoy = mesActual(), primero = (S.meses && S.meses[0] && S.meses[0].mes) || '2026-08', out = [];
  let [y, m] = primero.split('-').map(Number);
  for (let i = 0; i < 240; i++) { const k = `${y}-${String(m).padStart(2, '0')}`; out.push(k); if (k >= hoy) break; m++; if (m > 12) { m = 1; y++; } }
  return out;
}
function periodBar() {
  const meses = listaMeses(), varios = new Set(meses.map((m) => m.slice(0, 4))).size > 1;
  const cnt = (m) => { const x = S.meses && S.meses.find((r) => r.mes === m); return x ? Number(x.vecinos) : 0; };
  const chip = (k, l, n) => `<button class="mchip" type="button" data-mes="${k}" aria-pressed="${S.mes === k}">${esc(l)}${n !== null ? `<b>${num(n)}</b>` : ''}</button>`;
  const ocultas = S.pruebasOcultas ? ` (${num(S.pruebasOcultas)} ocultos)` : '';
  return `<div class="toolbar"><div class="mesbar" role="group" aria-label="Elegir mes">${meses.map((m) => { const [y, n] = m.split('-'); return chip(m, cap(MESES[n - 1]) + (varios ? ' ' + y : ''), S.meses ? cnt(m) : null); }).join('')}${chip('', 'Total', null)}</div>
  <label class="sw"><input type="checkbox" id="swPruebas" ${S.pruebas ? 'checked' : ''}><span>Incluir pruebas del equipo${S.pruebas ? '' : esc(ocultas)}</span></label></div>`;
}
function bindPeriod(root) {
  $$('.mchip', root).forEach((b) => b.addEventListener('click', () => { S.mes = b.dataset.mes; store.set('concejo_mes', S.mes); S.list.page = 0; route(); }));
  const cur = $('.mchip[aria-pressed="true"]', root); if (cur && cur.scrollIntoView) { const bar = cur.parentElement; bar.scrollLeft = cur.offsetLeft - bar.clientWidth / 2 + cur.clientWidth / 2; }
  const sw = $('#swPruebas', root);
  if (sw) sw.addEventListener('change', () => { S.pruebas = sw.checked; store.set('concejo_pruebas', S.pruebas ? '1' : '0'); S.list.page = 0; route(); });
}

/* ---------- ruteo ---------- */
function route() {
  const h = (location.hash || '#/resumen').replace('#/', '').split('?')[0];
  S.view = VIEWS[h] ? h : 'resumen';
  $('#pageTitle').textContent = VIEWS[S.view].t; $('#pageSub').textContent = VIEWS[S.view].s;
  document.title = `${VIEWS[S.view].t} · CRM Concejo`;
  paintNav(); render();
}
function destroyCharts() { S.charts.forEach((c) => c.destroy()); S.charts = []; }
const skel = (n = 4) => `<div class="rows">${'<div class="skel"></div>'.repeat(n)}</div>`;
async function render(silent) {
  const my = ++S.seq, v = $('#view');
  if (!silent) { destroyCharts(); v.innerHTML = skel(); }
  try {
    const html = await ({ resumen: vResumen, vecinos: vVecinos, derivaciones: vDeriv, buzon: vBuzon, ordenanzas: vOrds, auditoria: vAudit, marca: vMarca }[S.view])(my);
    if (my !== S.seq) return;
    banner('');
    if (html === null) return;
    if (silent && S.view !== 'resumen') { const y = scrollY; v.innerHTML = html; scrollTo(0, y); } else v.innerHTML = html;
    bindPeriod(v); afterRender(my);
  } catch (e) {
    if (e.auth || my !== S.seq) return;
    banner('No pudimos cargar los datos. Reintentamos solos en un minuto.', true);
    if (!silent) v.innerHTML = `<div class="empty">${ico('empty', 40)}Sin conexión con la base de datos.<br><button class="btn sm" id="retry" type="button" style="margin-top:12px">Reintentar</button></div>`, $('#retry')?.addEventListener('click', () => render());
  }
}
let after = null;
function afterRender() { if (after) { const f = after; after = null; f(); } }

/* ---------- Resumen ---------- */
const cssv = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
function barsHTML(items, key, max) {
  if (!items.length) return '<div class="empty">Sin datos en este período.</div>';
  const top = Math.max(...items.map((i) => Number(i[key])), 1);
  return `<div class="bars">${items.slice(0, max || 8).map((i) => `<div class="bar-row"><span>${esc(i.label ?? i.tema)}</span><div class="track"><div class="fill" style="width:${Math.max(4, (Number(i[key]) / top) * 100)}%"></div></div><b>${num(i[key])}</b></div>`).join('')}</div>`;
}
async function vResumen() {
  const s = await api('stats', per());
  S.meses = s.meses; S.pruebasOcultas = Number(s.pruebas_ocultas) || 0;
  S.badges.vecinos = Number(s.sin_atender) || 0; paintNav();
  const kp = (n, l, href, cls) => `<a class="kpi ${cls || ''}" href="${href}"><b>${num(n)}</b><span>${esc(l)}</span></a>`;
  const tipos = { text: 'Texto', audio: 'Audio', image: 'Imagen', document: 'Documento', video: 'Video', sticker: 'Sticker' };
  const tiposItems = (s.tipos || []).map((t) => ({ label: tipos[t.tipo] || t.tipo, n: t.n }));
  after = () => {
    if (!window.Chart) return;
    const dark = curTheme() === 'dark', grid = dark ? 'rgba(255,255,255,.08)' : 'rgba(31,58,95,.08)', tick = dark ? '#a2afc0' : '#5d646d';
    const base = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { color: tick, maxRotation: 0, autoSkip: true } }, y: { beginAtZero: true, grid: { color: grid }, ticks: { color: tick, precision: 0 } } } };
    const c1 = $('#chDiario'), c2 = $('#chHoras');
    if (c1) {
      const rows = S.mes ? s.diario : s.meses.map((m) => ({ dia: m.mes, mensajes: m.mensajes, vecinos: m.vecinos }));
      S.charts.push(new Chart(c1, { type: S.mes ? 'bar' : 'line', data: { labels: rows.map((r) => S.mes ? Number(String(r.dia).slice(8, 10)) : cap(MESES[Number(r.dia.slice(5)) - 1]).slice(0, 3)),
        datasets: [{ label: 'Vecinos', data: rows.map((r) => r.vecinos), backgroundColor: cssv('--sky'), borderColor: cssv('--sky'), borderRadius: 4, tension: .3 },
          { label: 'Mensajes', data: rows.map((r) => r.mensajes), backgroundColor: cssv('--c1'), borderColor: cssv('--c1'), borderRadius: 4, tension: .3 }] },
        options: { ...base, plugins: { legend: { display: true, labels: { color: tick, boxWidth: 12 } } } } }));
    }
    if (c2) {
      const h = Array.from({ length: 24 }, (_, i) => (s.horas.find((x) => x.hora === i) || { n: 0 }).n);
      S.charts.push(new Chart(c2, { type: 'bar', data: { labels: h.map((_, i) => i), datasets: [{ data: h, backgroundColor: cssv('--c1'), borderRadius: 3 }] }, options: base }));
    }
  };
  const hayDatos = Number(s.mensajes) > 0;
  return `${periodBar()}
  <div class="kpis">
    ${kp(s.vecinos, 'Vecinos ' + enPeriodo(), '#/vecinos')}
    ${kp(s.mensajes, 'Mensajes ' + enPeriodo(), '#/vecinos')}
    ${kp(s.derivaciones, 'Derivados a Coordinación', '#/derivaciones')}
    ${kp(s.mediaciones, 'Mediaciones ofrecidas', '#/derivaciones')}
    ${kp(s.propuestas, 'Propuestas al Buzón', '#/buzon')}
    ${kp(s.ordenanzas, 'Ordenanzas consultadas', '#/ordenanzas')}
    ${kp(s.sin_atender, 'Sin atender (derivados / propuestas)', '#/vecinos', Number(s.sin_atender) ? 'alert' : '')}
  </div>
  ${hayDatos ? `<div class="grid2">
    <section class="card"><h2>${S.mes ? 'Actividad por día' : 'Actividad por mes'}</h2><p class="sub">Vecinos distintos y mensajes ${esc(enPeriodo())}</p><div class="chart"><canvas id="chDiario" role="img" aria-label="Actividad ${esc(enPeriodo())}"></canvas></div></section>
    <section class="card"><h2>De qué hablan</h2><p class="sub">Tema principal de cada vecino</p>${barsHTML(s.temas, 'n', 9)}</section>
  </div>
  <div class="grid3">
    <section class="card"><h2>Horarios de consulta</h2><p class="sub">Mensajes por hora del día (hora de Jujuy)</p><div class="chart"><canvas id="chHoras" role="img" aria-label="Mensajes por hora"></canvas></div></section>
    <section class="card"><h2>Tipo de mensaje</h2><p class="sub">Cómo escriben los vecinos</p>${barsHTML(tiposItems, 'n', 6)}
      <p class="note">El Asistente atiende todos los días a toda hora. Los audios y fotos también se entienden.</p></section>
  </div>` : `<section class="card"><div class="empty">${ico('empty', 44)}No hay consultas ${esc(enPeriodo())}${S.pruebas ? '' : ' de vecinos (las pruebas del equipo están ocultas)'}.</div></section>`}`;
}

/* ---------- Vecinos ---------- */
function rowHTML(r) {
  const tags = [];
  if (r.atencion !== 'no_atendido') tags.push(`<span class="tag ${ATEN_CLS[r.atencion]}">${ATEN[r.atencion]}</span>`);
  if (r.derivs) tags.push('<span class="tag gold">Derivado</span>');
  if (r.propuestas) tags.push('<span class="tag gold">Propuesta</span>');
  if (r.mediaciones) tags.push('<span class="tag gold">Mediación</span>');
  if (r.es_prueba) tags.push('<span class="tag test">Prueba</span>');
  return `<button class="row" type="button" data-tel="${esc(r.telefono)}"><span class="ava h${hue(r.telefono)}">${esc(initials(r))}</span>
    <span style="min-width:0"><span class="nm">${esc(r.nombre || 'Sin nombre')} <span class="ph">${esc(phoneFmt(r.telefono))}</span>${tags.join('')}</span>
    <span class="lm" style="display:block">${esc(r.ultimo_msg || '')}</span></span>
    <span class="rt"><span>${esc(rel(r.ultimo))}</span><span>${num(r.msgs)} msj</span><span>${esc(r.tema || '')}</span></span></button>`;
}
const FILTROS = [['todos', 'Todos'], ['no_atendido', 'Sin atender'], ['seguimiento', 'En seguimiento'], ['atendido', 'Atendidos'], ['derivado', 'Derivados'], ['propuesta', 'Propuestas'], ['mediacion', 'Mediaciones'], ['ordenanza', 'Ordenanzas']];
async function vVecinos(my) {
  const L = S.list;
  const [d, st] = await Promise.all([api('list', { ...per(), q: L.q, filtro: L.filtro, orden: L.orden, page: L.page, size: L.size }), S.meses ? null : api('stats', per())]);
  if (st) { S.meses = st.meses; S.pruebasOcultas = Number(st.pruebas_ocultas) || 0; }
  cacheRows(d.rows);
  const chips = FILTROS.map(([k, l]) => `<button class="chip" type="button" data-f="${k}" aria-pressed="${L.filtro === k}">${l}<b>${num(d.counts[k])}</b></button>`).join('');
  const rows = d.rows.map(rowHTML).join('') || `<div class="empty">${ico('empty', 40)}No hay vecinos con ese filtro ${esc(enPeriodo())}.</div>`;
  const hay = (L.page + 1) * L.size < d.total;
  after = () => {
    const v = $('#view'), q = $('#q');
    $$('.chip', v).forEach((b) => b.addEventListener('click', () => { L.filtro = b.dataset.f; L.page = 0; render(); }));
    $$('.row', v).forEach((b) => b.addEventListener('click', () => openDrawer(b.dataset.tel)));
    let t; q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { L.q = q.value.trim(); L.page = 0; render(true).then(() => { const n = $('#q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }); }, 350); });
    $('#more')?.addEventListener('click', () => { L.page++; render(); });
    $('#less')?.addEventListener('click', () => { L.page--; render(); });
  };
  return `${periodBar()}
  <div class="search">${ico('search', 18)}<label class="sr" for="q">Buscar vecino</label><input id="q" type="search" value="${esc(L.q)}" placeholder="Buscar por nombre, barrio o teléfono" autocomplete="off"></div>
  <div class="chips" role="group" aria-label="Filtrar">${chips}</div>
  <div class="rows">${rows}</div>
  ${(L.page > 0 || hay) ? `<div style="display:flex;gap:8px;justify-content:center;margin-top:14px">${L.page > 0 ? '<button class="btn sm" id="less" type="button">← Anteriores</button>' : ''}<span style="align-self:center;color:var(--muted);font-size:13px">${L.page * L.size + 1}–${Math.min((L.page + 1) * L.size, d.total)} de ${num(d.total)}</span>${hay ? '<button class="btn sm" id="more" type="button">Siguientes →</button>' : ''}</div>` : ''}`;
}
function cacheRows(rows) { rows.forEach((r) => S.rows.set(r.telefono, { ...(S.rows.get(r.telefono) || {}), ...r })); }

/* ---------- Derivados ---------- */
const TIPO_D = { coordinacion: 'Coordinación', mediacion: 'Mediación', audiencia: 'Audiencia' };
async function vDeriv() {
  const [rows, st] = await Promise.all([api('derivs', per()), S.meses ? null : api('stats', per())]);
  if (st) { S.meses = st.meses; S.pruebasOcultas = Number(st.pruebas_ocultas) || 0; }
  const n = (t) => rows.filter((r) => t === 'todos' || r.tipo === t).length;
  const list = rows.filter((r) => S.deFiltro === 'todos' || r.tipo === S.deFiltro);
  after = () => {
    const v = $('#view');
    $$('.chip', v).forEach((b) => b.addEventListener('click', () => { S.deFiltro = b.dataset.f; render(true); }));
    $$('[data-tel]', v).forEach((b) => b.addEventListener('click', () => openDrawer(b.dataset.tel)));
  };
  const chips = [['todos', 'Todos'], ['coordinacion', 'Coordinación'], ['mediacion', 'Mediaciones'], ['audiencia', 'Audiencias']].map(([k, l]) => `<button class="chip" type="button" data-f="${k}" aria-pressed="${S.deFiltro === k}">${l}<b>${n(k)}</b></button>`).join('');
  const cards = list.map((r) => `<article class="ic k-${esc(r.tipo)}"><header><div class="who">${esc(r.nombre || 'Sin nombre')}<small>${esc(phoneFmt(r.telefono))}${r.barrio ? ' · ' + esc(r.barrio) : ''}</small></div>
    <span class="tag ${r.tipo === 'coordinacion' ? '' : 'gold'}">${TIPO_D[r.tipo]}</span></header>
    <p><b>Consulta</b>${esc(r.detalle || '—')}</p><p><b>Motivo</b>${esc(r.motivo || '—')}</p>
    <footer><span>${esc(r.cuando ? rel(r.cuando) : '—')}${r.es_prueba ? ' · prueba' : ''}</span><span style="display:flex;gap:8px;align-items:center"><span class="tag ${ATEN_CLS[r.atencion]}">${ATEN[r.atencion]}</span><button class="btn sm" type="button" data-tel="${esc(r.telefono)}">Abrir</button></span></footer></article>`).join('');
  return `${periodBar()}<div class="chips" role="group" aria-label="Tipo">${chips}</div>
  ${list.length ? `<div class="cards">${cards}</div>` : `<div class="empty">${ico('empty', 40)}No hay derivaciones ${esc(enPeriodo())}.</div>`}
  <p class="note">El Asistente no avisa a nadie automáticamente: le pasa al vecino el contacto de Coordinación General y es el vecino quien escribe. Acá queda el registro para que el equipo sepa quién lo pidió.</p>`;
}

/* ---------- Buzón ---------- */
async function vBuzon() {
  const [rows, st] = await Promise.all([api('buzon', per()), S.meses ? null : api('stats', per())]);
  if (st) { S.meses = st.meses; S.pruebasOcultas = Number(st.pruebas_ocultas) || 0; }
  after = () => $$('#view [data-tel]').forEach((b) => b.addEventListener('click', () => openDrawer(b.dataset.tel)));
  const cards = rows.map((r) => `<article class="ic"><header><div class="who">${esc(r.nombre || 'Sin nombre')}<small>${esc(phoneFmt(r.telefono))}${r.barrio ? ' · B.º ' + esc(r.barrio) : ''}</small></div><span class="tag gold">${esc(r.estado_revision || 'Pendiente')}</span></header>
    <p><b>Problema</b>${esc(r.problema || '—')}</p><p><b>Norma que propone</b>${esc(r.norma_propuesta || '—')}</p>
    <footer><span>${esc(txtFecha(r.fecha))}${r.es_prueba ? ' · prueba' : ''}</span><button class="btn sm" type="button" data-tel="${esc(r.telefono)}">Abrir vecino</button></footer></article>`).join('');
  return `${periodBar()}${rows.length ? `<div class="cards">${cards}</div>` : `<div class="empty">${ico('empty', 40)}No hay propuestas ${esc(enPeriodo())}.</div>`}
  <p class="note">Propuestas que los vecinos cargaron con el Buzón «Tu norma, tu ciudad». Coordinación General emite un informe cada 3 semanas.</p>`;
}

/* ---------- Ordenanzas ---------- */
async function vOrds() {
  const [d, st] = await Promise.all([api('ords', per()), S.meses ? null : api('stats', per())]);
  if (st) { S.meses = st.meses; S.pruebasOcultas = Number(st.pruebas_ocultas) || 0; }
  after = () => $$('#view [data-tel]').forEach((b) => b.addEventListener('click', () => openDrawer(b.dataset.tel)));
  const rk = d.ranking.map((r) => `<tr><td><b>N.º ${esc(r.numero)}</b></td><td class="n">${num(r.n)}</td><td class="n">${num(r.vecinos)}</td><td>${esc(txtFecha(r.ultima))}</td></tr>`).join('');
  const rc = d.recientes.map((r) => `<tr><td>${esc(txtFecha(r.fecha))}</td><td><b>N.º ${esc(r.numero)}</b></td><td>${esc(r.nombre || 'Sin nombre')}</td><td><button class="btn sm" type="button" data-tel="${esc(r.telefono)}">Abrir</button></td></tr>`).join('');
  return `${periodBar()}${d.ranking.length ? `<div class="grid3">
  <section class="card"><h2>Las más consultadas</h2><p class="sub">Número de ordenanza y cuántos vecinos la pidieron</p><div class="scroll-x"><table class="t"><thead><tr><th>Ordenanza</th><th class="n">Veces</th><th class="n">Vecinos</th><th>Última</th></tr></thead><tbody>${rk}</tbody></table></div></section>
  <section class="card"><h2>Consultas recientes</h2><p class="sub">Lo último que pidió cada vecino por número</p><div class="scroll-x"><table class="t"><thead><tr><th>Cuándo</th><th>Ordenanza</th><th>Vecino</th><th></th></tr></thead><tbody>${rc}</tbody></table></div></section></div>`
    : `<div class="empty">${ico('empty', 40)}Nadie consultó una ordenanza por número ${esc(enPeriodo())}.</div>`}
  <p class="note">Se registra cuando el vecino pide una ordenanza por su número. Las búsquedas por tema no se cuentan acá.</p>`;
}


/* ---------- Auditoría ---------- */
async function vAudit() {
  const [d, st] = await Promise.all([api('audit', per()), S.meses ? null : api('stats', per())]);
  if (st) { S.meses = st.meses; S.pruebasOcultas = Number(st.pruebas_ocultas) || 0; }
  after = () => { /* los detalles de concejales son <details>, sin JS */ };
  const pct = (n, t) => (t ? Math.round((n / t) * 1000) / 10 : 0).toString().replace('.', ',') + ' %';
  const nConc = (d.temas.find((t) => t.label === 'Concejales y autoridades') || { n: 0 }).n;
  const conc = d.concejales.map((c, i) => `<details class="ej"><summary><span class="pos">${i + 1}</span><b>${esc(c.nombre)}</b><span class="tag">${esc(c.bloque || '')}</span><span class="cnt">${num(c.n)} preguntas · ${num(c.vecinos)} vecinos</span></summary>
    <ul>${(c.ejemplos || []).map((e) => `<li>${esc(e)}</li>`).join('')}</ul></details>`).join('');
  const rep = d.repetidas.map((r) => `<tr><td>${esc(r.pregunta)}</td><td class="n">${num(r.n)}</td><td class="n">${num(r.vecinos)}</td><td>${esc(r.respuesta || '')}</td></tr>`).join('');
  const sin = d.sin_respuesta.map((r) => `<article class="qa"><p class="q"><b>Vecino</b>${esc(r.pregunta)}</p><p class="a"><b>Asistente</b>${esc(r.respuesta)}</p><small>${esc(rel(r.created_at))}</small></article>`).join('');
  const mm = d.meses.map((m) => `<tr><td><b>${esc(cap(mesNombre(m.mes)))}</b></td><td class="n">${num(m.vecinos)}</td><td class="n">${num(m.mensajes)}</td><td class="n">${num(m.ordenanzas)}</td><td class="n">${num(m.concejales)}</td><td class="n">${pct(m.no_supo, m.mensajes)}</td></tr>`).join('');
  const kp = (n, l, cls) => `<div class="kpi ${cls || ''}"><b>${n}</b><span>${esc(l)}</span></div>`;
  if (!Number(d.mensajes)) return `${periodBar()}<section class="card"><div class="empty">${ico('empty', 44)}No hay consultas ${esc(enPeriodo())}${S.pruebas ? '' : ' de vecinos (las pruebas del equipo están ocultas)'}.</div></section>`;
  return `${periodBar()}
  <div class="kpis">
    ${kp(num(d.mensajes), 'Mensajes ' + enPeriodo())}
    ${kp(num(d.vecinos), 'Vecinos distintos')}
    ${kp(num(nConc), 'Preguntas sobre concejales')}
    ${kp(pct(d.no_supo, d.mensajes), 'Respuestas «no tengo la información»', Number(d.no_supo) ? 'alert' : '')}
  </div>
  <div class="grid3">
    <section class="card"><h2>Qué preguntan más</h2><p class="sub">Tema de cada mensaje de los vecinos ${esc(enPeriodo())}</p>${barsHTML(d.temas, 'n', 12)}</section>
    <section class="card"><h2>Qué responde más el Asistente</h2><p class="sub">Tipo de respuesta ${esc(enPeriodo())}</p>${barsHTML(d.respuestas, 'n', 12)}</section>
  </div>
  <section class="card" style="margin-bottom:14px"><h2>Concejales más consultados</h2><p class="sub">Veces que los vecinos nombraron a cada concejal (por apellido). Tocá uno para ver qué preguntaron.</p>${conc || '<div class="empty">Nadie nombró a un concejal en este período.</div>'}</section>
  <div class="grid3">
    <section class="card"><h2>Preguntas que se repiten</h2><p class="sub">Mismo texto, 2 veces o más</p>${rep ? `<div class="scroll-x"><table class="t"><thead><tr><th>Pregunta</th><th class="n">Veces</th><th class="n">Vecinos</th><th>Cómo respondió</th></tr></thead><tbody>${rep}</tbody></table></div>` : '<div class="empty">No hay preguntas repetidas.</div>'}</section>
    <section class="card"><h2>Lo que no supo responder</h2><p class="sub">Respuestas donde dijo que no tiene la información. Son las que conviene cargar o revisar.</p>${sin || '<div class="empty">No hubo respuestas de este tipo.</div>'}</section>
  </div>
  <section class="card"><h2>Mes a mes</h2><p class="sub">Todos los meses, sin importar el filtro</p><div class="scroll-x"><table class="t"><thead><tr><th>Mes</th><th class="n">Vecinos</th><th class="n">Mensajes</th><th class="n">Ordenanzas</th><th class="n">Concejales</th><th class="n">Sin información</th></tr></thead><tbody>${mm}</tbody></table></div></section>
  <p class="note">Los temas y tipos de respuesta se clasifican automáticamente por palabras clave: sirven de guía, no son un dato exacto. «Otras» agrupa lo que no encaja en ninguna categoría.</p>`;
}

/* ---------- Manual de marca ---------- */
function vMarca() {
  const sw = [['Celeste Concejo', '#1f9cb5', '#fff', 'Color de marca: arcos del logo, encabezados, acentos (R31 G156 B181)'], ['Rojo', '#e42a20', '#fff', 'Rombos del logo: alertas y pendientes (R228 G42 B32)'], ['Naranja', '#f29e1d', '#082a33', 'Rombos del logo: avisos y etiquetas (R242 G158 B29)'], ['Amarillo', '#ece31b', '#082a33', 'Rombo del logo: detalle puntual (R236 G227 B27)'], ['Gris', '#939598', '#fff', 'Bajada del logo y texto secundario (R147 G149 B152)'], ['Celeste profundo', '#167a8f', '#fff', 'Derivado: botones y texto de acento con buen contraste'], ['Celeste suave', '#e4f4f7', '#082a33', 'Derivado: fondos de sección'], ['Blanco', '#ffffff', '#082a33', 'Tarjetas y superficies']];
  return `<div class="mk-hero"><img src="assets/logo-apilado.png" alt="Logo del Concejo Deliberante" style="background:#fff;border-radius:18px;padding:12px;width:200px;height:auto"><div><h2>Concejo Deliberante de San Salvador de Jujuy</h2><p>Institucional, claro y cercano. Predominan el celeste y el blanco; el rojo, naranja, amarillo y gris de los rombos del logo se usan solo como acento. Fuente: Manual CD Jujuy.</p></div></div>
  <section class="card" style="margin-bottom:14px"><h2>Paleta</h2><p class="sub">Proporción sugerida: 60 % blanco · 30 % celeste · 10 % rombos de acento</p><div class="sws">${sw.map(([n, c, t, u]) => `<div class="swc"><i style="background:${c}"></i><div><b>${n}</b><code>${c}</code><br><span style="color:var(--muted)">${u}</span></div></div>`).join('')}</div></section>
  <div class="grid3">
    <section class="card"><h2>Tipografía</h2><p class="sub">«Creato Display», según el manual</p><p class="type-ex">Ordenanzas vigentes</p><p style="margin-top:8px"><b>Títulos:</b> Creato Display Bold. <b>Texto:</b> Creato Display Regular / Light, 15 px.</p><p class="note">Si el equipo no la tiene instalada se usa Helvetica/Arial. Para usar la original, pasame el archivo de la fuente.</p></section>
    <section class="card"><h2>Logo</h2><p class="sub">Un ojo celeste que observa y rombos de colores que forman una flecha: transparencia y datos</p><div class="logo-row">
      <div class="logo-box light"><img src="assets/logo-horizontal.png" alt="Logo horizontal" style="width:260px;height:auto"></div>
      <div class="logo-box cream"><img src="assets/logo-apilado.png" alt="Logo apilado" style="width:140px;height:auto"></div></div>
      <p class="note">Versiones horizontal y apilada del manual del Concejo. Usarlas sobre fondo blanco o muy claro, sin deformar ni cambiar colores.</p></section>
  </div>
  <section class="card" style="margin-top:14px"><h2>Tono de voz</h2><p class="sub">Cómo habla el Asistente y cómo se escribe en este sistema</p><div class="dos">
    <div><b>Sí</b><ul><li>Voseo cercano y respetuoso: «Podés consultar…»</li><li>Frases cortas, un mensaje por bloque.</li><li>Decir «Asistente Virtual» o «Agente IA», no «bot».</li><li>Datos oficiales y citados; si no está cargado, se dice.</li></ul></div>
    <div><b>No</b><ul><li>Opinar de política o elecciones.</li><li>Interpretar ordenanzas ni confirmar si están vigentes.</li><li>Prometer llamados o avisos que no se hacen.</li><li>Usar rojo o naranja fuera de alertas y avisos.</li></ul></div></div></section>`;
}

/* ---------- detalle (drawer) ---------- */
let dTab = 'chat';
async function openDrawer(tel) {
  S.openTel = tel; dTab = 'chat';
  const dr = $('#drawer'), base = S.rows.get(tel) || { telefono: tel };
  dr.innerHTML = headHTML(base) + '<div class="dr-body">' + skel(3) + '</div>';
  dr.classList.add('open'); dr.setAttribute('aria-hidden', 'false'); $('#scrim').hidden = false; dr.focus?.();
  bindHead(dr);
  try {
    const d = await api('detail', { telefono: tel });
    if (S.openTel !== tel) return;
    S.detail = d; const c = { ...base, ...d.contacto }; S.rows.set(tel, c);
    paintDrawer(c);
  } catch (e) { if (!e.auth) $('.dr-body', dr).innerHTML = '<div class="empty">No pudimos cargar el detalle.</div>'; }
}
function closeDrawer() { S.openTel = null; const d = $('#drawer'); d.classList.remove('open'); d.setAttribute('aria-hidden', 'true'); $('#scrim').hidden = true; }
function headHTML(r) {
  const wa = `https://wa.me/${esc(r.telefono)}`;
  return `<div class="dr-h"><div class="dr-top"><span class="ava h${hue(r.telefono)}">${esc(initials(r))}</span><div style="flex:1;min-width:0"><h2>${esc(r.nombre || 'Sin nombre')}</h2><small>${esc(phoneFmt(r.telefono))}${r.barrio ? ' · B.º ' + esc(r.barrio) : ''}${r.es_prueba ? ' · número de prueba' : ''}</small></div><button class="icon-btn" id="drClose" type="button" aria-label="Cerrar">${ico('x', 20)}</button></div>
  <div class="seg3" role="group" aria-label="Estado de atención">${Object.entries(ATEN).map(([k, l]) => `<button type="button" data-a="${k}" aria-pressed="${r.atencion === k}">${l}</button>`).join('')}</div>
  <div class="dr-actions"><a class="btn sm" href="${wa}" target="_blank" rel="noopener">${ico('wa', 16)} Abrir WhatsApp</a><button class="btn sm" id="drEdit" type="button">Editar nombre</button></div>
  ${r.atendido_por && r.atencion !== 'no_atendido' ? `<small style="color:#b6c4d6">${ATEN[r.atencion]} por ${esc(r.atendido_por)} · ${esc(rel(r.atendido_at))}</small>` : ''}</div>
  <div class="dr-tabs" role="tablist"><button role="tab" data-t="chat" aria-selected="true">Conversación</button><button role="tab" data-t="notas" aria-selected="false">Notas</button><button role="tab" data-t="reg" aria-selected="false">Registros</button></div>`;
}
function bindHead(dr) {
  $('#drClose', dr)?.addEventListener('click', closeDrawer);
  $$('.seg3 button', dr).forEach((b) => b.addEventListener('click', () => needOp(() => saveAten(b.dataset.a))));
  $('#drEdit', dr)?.addEventListener('click', editName);
  $$('.dr-tabs button', dr).forEach((b) => b.addEventListener('click', () => { dTab = b.dataset.t; paintBody(); $$('.dr-tabs button', dr).forEach((x) => x.setAttribute('aria-selected', String(x === b))); }));
}
function paintDrawer(c) {
  const dr = $('#drawer'); dr.innerHTML = headHTML(c) + '<div class="dr-body" id="drBody"></div>'; bindHead(dr);
  $$('.dr-tabs button', dr).forEach((x) => x.setAttribute('aria-selected', String(x.dataset.t === dTab)));
  paintBody();
}
function paintBody() {
  const b = $('.dr-body'), d = S.detail; if (!b || !d) return;
  if (dTab === 'chat') {
    let last = '', h = '';
    d.mensajes.forEach((m) => {
      const k = dayKey(new Date(m.created_at)); if (k !== last) { h += `<span class="day">${esc(dayLabel(m.created_at))}</span>`; last = k; }
      const adj = m.tipo_mensaje !== 'text' ? `[${m.tipo_mensaje === 'audio' ? 'Audio' : m.tipo_mensaje === 'image' ? 'Imagen' : m.tipo_mensaje}]` : '';
      const txt = m.mensaje_usuario || adj;
      if (txt) h += `<div class="msg in">${esc(txt)}<small>${esc(hhmm(new Date(m.created_at)))}</small></div>`;
      if (m.respuesta_ai) h += `<div class="msg out">${esc(m.respuesta_ai)}<small>Asistente · ${esc(hhmm(new Date(m.created_at)))}</small></div>`;
    });
    b.innerHTML = h || '<div class="empty">Sin mensajes.</div>';
    b.scrollTop = b.scrollHeight;
  } else if (dTab === 'notas') {
    b.innerHTML = `<form class="note-form" id="noteForm"><label class="sr" for="noteTxt">Nueva nota</label><textarea id="noteTxt" maxlength="2000" placeholder="Escribí lo que hablaron o lo que falta hacer…" required></textarea><button class="btn primary" type="submit">Guardar nota</button></form>
      ${d.notas.map((n) => `<div class="note-card">${esc(n.texto)}<small>${esc(n.autor || 'Equipo')} · ${esc(longDate(n.created_at))}</small></div>`).join('') || '<p class="note">Todavía no hay notas.</p>'}`;
    $('#noteForm').addEventListener('submit', (e) => { e.preventDefault(); needOp(addNote); });
  } else {
    const L = (arr, f) => arr.length ? arr.map(f).join('') : '<span style="color:var(--muted)">Nada registrado.</span>';
    b.innerHTML = `<div class="reg"><h3>Derivaciones a Coordinación</h3>${L(d.derivaciones, (x) => `<div><b>${esc(rel(x.created_at))}</b> · ${esc(x.consulta || '')}<br><small style="color:var(--muted)">${esc(x.motivo || '')}</small></div>`)}
      <h3>Propuestas al Buzón</h3>${L(d.propuestas, (x) => `<div><b>${esc(txtFecha(x.fecha))}</b> · ${esc(x.problema || '')}<br><small style="color:var(--muted)">Propone: ${esc(x.norma_propuesta || '—')} · ${esc(x.estado_revision || '')}</small></div>`)}
      <h3>Mediaciones</h3>${L(d.mediaciones, (x) => `<div><b>${esc(txtFecha(x.fecha))}</b> · ${esc(x.tipo_conflicto || '')}<br><small style="color:var(--muted)">${esc(x.detalle || '')} → ${esc(x.derivado_a || '')}</small></div>`)}
      <h3>Ordenanzas consultadas</h3>${L(d.ordenanzas, (x) => `<div><b>N.º ${esc(x.numero)}</b> <small style="color:var(--muted)">${esc(txtFecha(x.fecha))}</small></div>`)}</div>`;
  }
}
async function saveAten(a) {
  const tel = S.openTel; if (!tel) return;
  const cur = S.rows.get(tel) || {}, next = cur.atencion === a ? 'no_atendido' : a;
  try {
    const r = await api('save', { telefono: tel, atencion: next, por: S.op });
    S.rows.set(tel, { ...cur, ...r }); paintDrawer(S.rows.get(tel));
    toast(next === 'no_atendido' ? 'Marcado como sin atender' : `${ATEN[next]} por ${S.op}`);
    if (S.view === 'vecinos' || S.view === 'resumen') render(true);
  } catch (e) { if (!e.auth) toast('No se pudo guardar. Probá de nuevo.'); }
}
async function addNote() {
  const t = $('#noteTxt').value.trim(), tel = S.openTel; if (!t || !tel) return;
  try { const n = await api('note', { telefono: tel, texto: t, por: S.op }); S.detail.notas.unshift(n); paintBody(); toast('Nota guardada'); }
  catch (e) { if (!e.auth) toast('No se pudo guardar la nota.'); }
}
function editName() {
  const tel = S.openTel, c = S.rows.get(tel) || {}, box = $('.dr-actions');
  box.innerHTML = `<form class="edit-name" id="nmForm" style="flex:1"><label class="sr" for="nmIn">Nombre</label><input id="nmIn" maxlength="80" value="${esc(c.nombre || '')}" placeholder="Nombre del vecino"><button class="btn sm" type="submit">Guardar</button></form>`;
  $('#nmIn').focus();
  $('#nmForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { const r = await api('save', { telefono: tel, nombre: $('#nmIn').value.trim(), por: S.op }); S.rows.set(tel, { ...c, ...r }); paintDrawer(S.rows.get(tel)); toast('Nombre guardado'); if (S.view === 'vecinos') render(true); }
    catch (er) { if (!er.auth) toast('No se pudo guardar.'); }
  });
}

/* ---------- arranque ---------- */
function init() {
  const t = store.get('concejo_theme'); if (t) document.documentElement.dataset.theme = t;
  buildNav(); applyTheme(); paintOp();
  $('#loginForm').addEventListener('submit', doLogin);
  $('#lgShow').addEventListener('click', (e) => { const i = $('#lgPass'), show = i.type === 'password'; i.type = show ? 'text' : 'password'; e.currentTarget.textContent = show ? 'Ocultar' : 'Mostrar'; e.currentTarget.setAttribute('aria-pressed', String(show)); });
  $('#themeBtn').addEventListener('click', () => applyTheme(curTheme() === 'dark' ? 'light' : 'dark'));
  $('#themeBtnM').addEventListener('click', () => applyTheme(curTheme() === 'dark' ? 'light' : 'dark'));
  $('#refreshBtn').addEventListener('click', () => render());
  $('#logoutBtn').addEventListener('click', () => { lock(); });
  $('#scrim').addEventListener('click', closeDrawer);
  $('#opBtn').addEventListener('click', () => openPop()); $('#opBtnM').addEventListener('click', () => openPop());
  $('#opCancel').addEventListener('click', closePop);
  $('#opForm').addEventListener('submit', (e) => { e.preventDefault(); const v = $('#opInput').value.trim(); if (!v) return; S.op = v; store.set('concejo_op', v); paintOp(); const f = $('#opPop')._after; closePop(); if (f) f(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (!$('#opPop').hidden) closePop(); else if (S.openTel) closeDrawer(); } });
  addEventListener('hashchange', () => { closeDrawer(); route(); });
  setInterval(() => { if (!S.token || document.hidden || S.openTel || !$('#opPop').hidden) return; if (document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return; render(true); }, POLL_MS);
  if (S.token) { unlock(); route(); } else lock();
}
init();
})();
