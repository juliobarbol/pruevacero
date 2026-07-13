# CLAUDE.md — PruevaCero (app de análisis de jugadores de fútbol)

> Mapa del proyecto para trabajar sin quemar tokens y sin romper nada.
> **La hoja de ruta viva (etapas hechas/pendientes y decisiones de producto)
> está en `PLAN.md` — leela SIEMPRE antes de implementar algo nuevo y
> mantenela al día (marcar etapas HECHAS, anotar decisiones nuevas de Julio).**
>
> **AUTORIZACIÓN PERMANENTE DE JULIO (2026-07-10): después de completar y
> verificar un cambio, mergear a `main` y hacer push SIN pedir permiso.**
> Julio no puede probar en la rama de trabajo (solo prueba en la app
> publicada), así que publicar es la única forma de que vea el cambio.
> Siempre verificar sintaxis + funcional ANTES de mergear (sos el único
> control de calidad). PR solo si Julio lo pide explícitamente.

## Qué es

App PWA para que un profesor/entrenador de fútbol formativo que da clases en
varios equipos lleve el seguimiento de sus jugadores: equipos (con escudo y
categorías por rango de años), fichas con biometría y foto, pruebas físicas
con creador flexible, cronómetro grupal con vueltas (pestaña ⏱ Crono, guarda
directo en la jornada de pruebas), partidos (minutos automáticos por cambios),
asistencia a clases, estadísticas y evaluación técnica 1–10 con radar.

- **Producción**: https://pruevacero.juliobarribolbo.workers.dev
- Worker de Cloudflare `pruevacero`, conectado al repo GitHub
  `juliobarbol/pruevacero`. **Rama de producción: `main`** (mergear a main =
  publicar; Cloudflare despliega solo en ~1 min).

## Forma del proyecto (misma receta que StockMerger / Presupuestos AR)

- **PWA de un solo archivo**: todo en `index.html` (HTML + CSS + JS vanilla,
  sin frameworks ni build). JS en ámbito global con `onclick="..."` — **NO
  convertir a módulos ES**.
- `sw.js` + `manifest.webmanifest` + íconos → instalable y offline-first.
  El HTML se sirve network-first (las actualizaciones llegan solas).
- **La versión del cache la estampa `build.py`** vía el workflow
  `.github/workflows/stamp-sw.yml` en cada push a `main` (commit
  "[skip stamp]"). No hace falta bump manual; verificar tras publicar que
  `const CACHE` en el sw.js SERVIDO tenga timestamp nuevo.
- Datos en `localStorage` (`pc_data`, `pc_ui`, `pc_theme`) vía `safeSetLS`.
  **Fotos y escudos en IndexedDB** (`pruevacero_photos`), en el estado solo
  viaja el id (`fotoId`/`escudoId`); caché síncrona `_photoCache` +
  `hydratePhotoCache()` al arrancar. El backup JSON adjunta las fotos.
- Dependencias CDN (cdnjs, con SRI): SheetJS (xlsx 0.18.5) para Excel y
  jsPDF (2.5.1) para el informe PDF del jugador. Ambas necesitan internet la
  PRIMERA vez; después el SW las cachea.

## Trabajar sin quemar tokens

`index.html` pesa ~130 KB / ~2.800 líneas y crece. **No leerlo entero.**
Localizar con `Grep -n` y leer solo el tramo. Los módulos JS tienen banners
`===== js/<nombre>.js =====`; listarlos con:

```bash
grep -n "===== js/" index.html
```

| Región / módulo | Rol |
|---|---|
| `<head>` (1–19) | CDN xlsx + script de tema temprano |
| `<style>` (20–266) | CSS (variables `:root` + `html[data-theme="light"]`) |
| HTML (268–575) | pestañas, overlays, nav inferior, inputs file ocultos |
| `js/state.js` | `S` (datos) + `UI`, `LS`, defaults (`DEF_TESTDEFS`, `DEF_ASPECTS`, `LINEAS/ROLES`), helpers (`esc`, `todayISO`, `fmtFecha`, `edad`, `catOf`, `toast`, `download`) |
| `js/modal.js` | `appConfirm` / `appPromptText` (nada de `prompt()`/`confirm()` nativos) |
| `js/photos.js` | IndexedDB de fotos, `savePhoto/getPhoto/deletePhoto`, `pickImage` (achica con canvas), `avatarHtml`, `teamLogoHtml` |
| `js/ui.js` | tema, `switchTab` (acá se enganchan los render por pestaña), overlays |
| `js/teams.js` | equipos: alta/renombrar/borrar, selector, escudo |
| `js/cats.js` | categorías por rango de años (`playerCat`, `catLabelFor`) + días/hora de clase |
| `js/players.js` | lista con filtros, ficha (`openFicha` arma TODAS las tarjetas), form, mover/exportar/importar jugador |
| `js/goals.js` | lesiones (`p.lesiones`) y objetivos (`p.objetivos`) en la ficha: `renderLesionesCard`/`renderObjetivosCard`, alta/borrar/cumplir |
| `js/pdf.js` | informes PDF (jsPDF): jugador (`exportPlayerPdf`), ejercicio (`exportExercisePdf`, cancha rasterizada con `pzBoardPng`, secuencia de pasos) y sesión (`exportSesionPdf`, bloques con miniaturas). Sin emojis dentro del PDF |
| `js/tests.js` | creador de pruebas + jornadas + evolución (`renderEvolution`) |
| `js/crono.js` | pestaña ⏱ Crono: cronómetro grupal (tanda en `UI.crono`, tiempo SIEMPRE por hora real `Date.now`−`startAt`, vueltas, meta, orden de llegada, Wake Lock, beeps); al guardar escribe la jornada de HOY (`resultados` + `vueltas`) |
| `js/groups.js` | Grupos de rendimiento (botón en Pruebas, overlay `ovGrupos`): 3 grupos DERIVADOS de la última marca, modo auto (tercios) o umbral (cortes en `testDef.grupos`); colores/nombres en `S.grupos`; benchmarking por posición, subió/bajó, armar equipos parejos |
| `js/matches.js` | partidos: titulares, cambios, `minutosDe` (minutos DERIVADOS), planilla con steppers |
| `js/attendance.js` | pestaña Clases: pasar lista (P/A/L), retroactivo, % asistencia; **RPE** por presente + duración de la clase (`a.rpe`/`a.durMin`), carga = RPE×min (`cargaDe`) y tarjeta de carga semanal con ⚠ si supera 150% del promedio de 4 semanas |
| `js/evals.js` | evaluación 1–10, aspectos configurables, `drawRadar` (canvas propio), `catAvgScores` |
| `js/board.js` | pestaña 📋 Pizarra (3 vistas: Ejercicios / Sesiones / 📅 Semana): ejercicios en `S.exercises` (funciones `pz*`/`ex*`); cancha SVG 68×105 con tokens (2 equipos + pelota, `label`/`pid` para nombres) y zonas arrastrables por pointer events, chapitas/figuras, ficha del ejercicio; animación por pasos (`board.frames`, `pzTick`/`pzPlay`), video WebM (`pzCanvasDraw` + MediaRecorder), biblioteca `PZ_LIB` (20 precargados), compartir (`exExport`/`importExerciseJson`), semana `renderPzWeek`. ⚠️ rAF casi no corre bajo `--virtual-time-budget`: en tests llamar `pzTick(t)` a mano |
| `js/sessions.js` | Sesiones de entrenamiento (`S.trainSessions`, vista "🗓 Sesiones" del toggle en Pizarra, funciones `ses*`): bloques cal/ppal/vc con ejercicios de la pizarra o actividades libres, minutos con default en `carga.dur`, total derivado (`sesTotalMin`), duplicar, "sesión de hoy" en Clases |
| `js/backup.js` | backup JSON completo (incluye fotos) |
| `js/export.js` | Excel con autofiltro (jugadores / estadísticas / jornada) |
| `js/stats.js` | agregados (`aggFor`), tabla comparativa, resúmenes de ficha |
| `js/core.js` | arranque + registro del SW + hidratación de fotos |

El modelo de datos completo está en `PLAN.md` (sección "Modelo de datos").

## Flujo de trabajo con Julio (igual que sus otras apps)

Julio **no es programador** y prueba SOLO en la app publicada:

1. Implementar la etapa/cambio completo de forma autónoma.
2. Verificar (ver abajo) — sos el único control de calidad.
3. Commit en la rama de trabajo → **merge a `main` → push** (publicar sin
   preguntar; PR solo si lo pide).
4. Verificar el deploy en vivo (curl al sitio buscando un string nuevo) y el
   estampado del sw.js (una vez por tanda).
5. Reportar CORTO y en castellano simple: qué cambió + 1-2 pasos para
   probarlo. Marcar la etapa como HECHA en `PLAN.md` en el mismo commit.

## Cómo verificar cambios

**Sintaxis** (obligatorio antes de publicar):
```bash
python3 - <<'PY'
import re, subprocess, sys
html = open('index.html', encoding='utf-8').read()
js = "\n;\n".join(re.findall(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', html, re.S))
open('/tmp/app_check.js','w',encoding='utf-8').write(js)
sys.exit(subprocess.run(['node','--check','/tmp/app_check.js']).returncode)
PY
```

**Funcional** (patrón usado en todas las etapas): copiar `index.html` a un
scratchpad como `testN.html` agregando antes de `</body>` un `<script>` que
en `window load` arma datos por código, llama a las funciones reales, junta
`checks.push(...)` y termina con `document.title = 'TEST-PASS' | 'TEST-FAIL:...'`.
Servir el scratchpad con `python3 -m http.server 8642` y correr:
```bash
/opt/pw-browsers/chromium --headless --disable-gpu --no-sandbox --no-proxy-server \
  --virtual-time-budget=8000 --dump-dom "http://127.0.0.1:8642/testN.html" \
  | grep -oE "<title>[^<]*</title>"
```
⚠️ Trampas conocidas: con `--virtual-time-budget` **los `await` de IndexedDB
reales nunca resuelven** (no esperarlos en tests); IndexedDB tampoco anda en
`file://` (por eso el server HTTP local). Los modales propios se confirman con
`setTimeout(()=>mOk.click(),50)` antes de `await` de la función.

## Cosas que NO romper

- Claves de `localStorage` (`pc_data`, `pc_ui`, `pc_theme`) y el shape de
  `S` (ver `PLAN.md`); siempre defaultear campos nuevos en `loadData()` y en
  `importBackupFile()` para no romper datos viejos.
- Fechas de calendario SIEMPRE en local (`todayISO`, `fmtFecha`, `dowOf`
  parsean por partes) — nunca `toISOString().slice(0,10)`.
- Escapar TODO dato de usuario con `esc()` antes de meterlo en `innerHTML`.
- Los minutos de partido NO se guardan: se derivan (`minutosDe`). Los ids
  internos (`testDefs`, aspectos `a_*`, categorías) no se renombran.
- El repo se sirve TAL CUAL como assets: nada de secretos/tokens en el repo;
  archivos no-app van a `.assetsignore`.

## PENDIENTE (próximas sesiones)

Fuente de verdad: tabla de etapas de `PLAN.md`. Al 2026-07-13 están HECHAS
**todas las etapas (0–30)**: crono, grupos, PWA instalable, el módulo
completo de planificación (pizarra táctica con animación —pasos al final,
deshacer y versiones restaurables—, 4 equipos, cancha reglamentaria, video
MP4, multimedia guardada, líneas/flechas, guías personalizables numeradas,
etiquetas de zona, carriles pintados, multi-touch, rotación, nombres y
jugadores por posición, carpetas por objetivo, biblioteca, compartir),
sesiones por bloques, PDF de ejercicio/sesión, vista Semana y el control de
carga RPE. No hay pedidos pendientes.

Ideas menores / oportunidades (ninguna pedida por Julio todavía):

- Los exportes Excel/PDF necesitan internet la PRIMERA vez (CDN); después
  quedan cacheados por el SW.
- En GitHub la rama por defecto del repo sigue siendo la de trabajo
  `claude/pruebacero-player-analysis-7hu1mm` (la producción en Cloudflare
  ya apunta a `main`, eso está bien). Si algún día se cambia la rama por
  defecto a `main` en GitHub, mejor.
- Ideas no pedidas aún: filtro por categoría en Pruebas/Stats, radar en el
  Excel, recordatorio de backup, informe PDF a nivel equipo/categoría.
