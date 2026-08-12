// ════════════════════════════════════════════════════════════════════
// SERVICE WORKER — PruevaCero (PWA)
// ════════════════════════════════════════════════════════════════════
// Cachea el "shell" de la app (HTML, manifest, íconos) para que abra sin
// internet. El HTML se sirve network-first CON TIMEOUT: si la red no
// contesta en NAV_TIMEOUT ms (señal mala en una cancha), se abre desde el
// cache en vez de quedarse colgado. Las actualizaciones siguen llegando
// solas al abrir la app con conexión.
//
// Reglas para no dejar a nadie a pie en la cancha:
//  - El install FALLA si no puede guardar el HTML → el SW viejo (con su
//    cache que sí funcionaba) sigue vivo.
//  - El activate borra caches viejas SOLO si la nueva tiene el HTML.
//  - Ningún handler devuelve undefined: siempre hay una Response.
//
// La versión del cache (CACHE) la estampa build.py — lo corre el workflow
// .github/workflows/stamp-sw.yml en cada push a main (o a mano:
// `python build.py`). Así cada release invalida el cache anterior y los
// usuarios reciben la última versión sin bump manual.
// ════════════════════════════════════════════════════════════════════

const CACHE = 'pruevacero-20260812-001955';

// Cache APARTE para las librerías de CDN (Excel/PDF): NO lleva versión, así
// sobrevive a las actualizaciones de la app y no hace falta internet de
// nuevo tras cada release. Las URLs del CDN ya van versionadas (xlsx/0.18.5,
// jspdf/2.5.1), no cambian de contenido.
const CDN_CACHE = 'pruevacero-cdn-v1';

// Cuánto esperamos a la red antes de abrir desde el cache.
const NAV_TIMEOUT = 3000;

// Claves con las que el navegador puede pedir el HTML al abrir la app.
const SHELL_KEYS = ['./', './index.html'];

// Recursos propios que no son el HTML: si alguno falla, la app igual abre.
const EXTRA = [
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable.png'
];

// Librerías de CDN: se precachean para que exportar Excel/PDF ande offline.
const CDN_LIBS = [
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

function fetchWithTimeout(req, ms){
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(req).then(
      r => { clearTimeout(t); resolve(r); },
      e => { clearTimeout(t); reject(e); }
    );
  });
}

// Guarda el HTML bajo TODAS las claves del shell (una sola descarga).
async function putShell(cache, res){
  await Promise.all(SHELL_KEYS.map(k => cache.put(k, res.clone()).catch(() => {})));
}

async function precache(){
  const c = await caches.open(CACHE);
  // Crítico: sin HTML no hay app offline. Si esto tira, falla el install
  // (con timeout: si la red cuelga queremos fallar, no quedarnos instalando).
  const res = await fetchWithTimeout(new Request('./index.html', { cache: 'reload' }), 15000);
  if (!res || !res.ok) throw new Error('no se pudo bajar el HTML para el cache');
  await putShell(c, res);
  await Promise.all(EXTRA.map(u => c.add(u).catch(() => {})));
  // Las del CDN van al cache persistente y no bloquean nada.
  const cdn = await caches.open(CDN_CACHE);
  await Promise.all(CDN_LIBS.map(async u => {
    if (!(await cdn.match(u))) await cdn.add(u).catch(() => {});
  }));
}

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(precache());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    const shellOk = await c.match('./index.html', { ignoreVary: true });
    if (shellOk){
      const keys = await caches.keys();
      await Promise.all(keys
        .filter(k => k !== CACHE && k !== CDN_CACHE)
        .map(k => caches.delete(k)));
    }
    await self.clients.claim();
  })());
});

async function shellFromCache(req){
  const c = await caches.open(CACHE);
  return (await c.match(req, { ignoreSearch: true, ignoreVary: true }))
      || (await c.match('./index.html', { ignoreVary: true }))
      || (await c.match('./', { ignoreVary: true }));
}

// Última red: si nunca se cacheó el HTML, no dejamos la pantalla de error
// del navegador sino un mensaje que se entienda.
function offlinePage(){
  return new Response(
    '<!doctype html><html lang="es"><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>PruevaCero</title>' +
    '<body style="font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;' +
    'display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center">' +
    '<div><h1 style="font-size:1.2rem">PruevaCero</h1>' +
    '<p style="color:#94a3b8">Todavía no quedó guardada para usar sin internet.<br>' +
    'Abrila una vez con conexión y después funciona offline.</p></div>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

async function handleNav(req){
  try {
    const r = await fetchWithTimeout(req, NAV_TIMEOUT);
    if (!r || !r.ok) throw new Error('respuesta no válida');
    const cp = r.clone();
    caches.open(CACHE).then(c => putShell(c, cp)).catch(() => {});
    return r;
  } catch (_){
    return (await shellFromCache(req)) || offlinePage();
  }
}

async function handleAsset(req, sameOrigin){
  const c = await caches.open(sameOrigin ? CACHE : CDN_CACHE);
  const m = await c.match(req, { ignoreVary: true });
  if (m) return m;
  try {
    const r = await fetch(req);
    if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()).catch(() => {});
    return r;
  } catch (_){
    return new Response('', { status: 504, statusText: 'Sin conexión' });
  }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (_) { return; }

  // Navegación / documento HTML: network-first con timeout, cae al cache.
  if (req.mode === 'navigate' || req.destination === 'document'){
    e.respondWith(handleNav(req));
    return;
  }

  // Resto: cache-first. Lo de otro origen (CDN) va al cache persistente.
  e.respondWith(handleAsset(req, url.origin === self.location.origin));
});
