# Plan — App de análisis de jugadores (PruevaCero)

> Documento de arranque del proyecto. Acá está el plan acordado con Julio a
> partir de los audios del cuerpo técnico. Se implementa **por etapas**; al
> terminar cada etapa se marca como HECHA y se anota cualquier cambio de
> alcance.

## Qué es

App para que un **profesor/entrenador de fútbol formativo que da clases en
varios equipos** lleve el seguimiento de sus jugadores: equipos, ficha
personal y biometría, pruebas físicas con historial, posiciones, y
estadísticas de partidos (minutos, goles, tarjetas, etc.) con promedios
automáticos.

## Decisiones de producto (de Julio) — fuente de verdad

> Mantener esta sección al día, como en los CLAUDE.md de las otras apps.

- **Equipos como eje central (2026-07-05)**: la app NO es una lista plana de
  jugadores. El profesor crea **equipos** y añade jugadores a un equipo
  específico. Toda la app trabaja sobre el equipo activo (selector arriba).
- **Mover / exportar jugadores entre equipos (2026-07-05)**: si un jugador
  cambia a otro equipo del mismo profesor, se lo puede **mover** de equipo
  (conserva TODA su ficha e historial de pruebas; las estadísticas de
  partidos quedan asociadas al equipo donde las jugó). También se puede
  **exportar la ficha** de un jugador a un archivo para importarla en otro
  dispositivo/instalación.
- **Creador de pruebas flexible (2026-07-05)**: las pruebas físicas NO son
  una lista fija. Hay un **creador de pruebas** donde se define una prueba
  una vez (nombre, unidad, tipo de dato, si "mejor" es más alto o más bajo)
  y queda guardada para seleccionarla rápido en cualquier jornada. Las
  pruebas de los audios vienen precargadas como punto de partida.
- **Ideas extra aprobadas (2026-07-05)**: se implementan también las
  opciones investigadas de otras apps (ver etapas 6–8): puntaje
  técnico/táctico con radar, comparación contra el promedio de la categoría,
  asistencia a entrenamientos, historial de lesiones, objetivos por jugador
  e informe PDF del jugador.
- El "elo test" de los audios se interpreta como **test Yo-Yo** (resistencia
  intermitente). Confirmar con el cuerpo técnico.
- **Cronómetro grupal con pestaña propia (2026-07-07)**: pestaña ⏱ Crono.
  Selección de participantes por categoría/año o manual, cronómetros
  individuales por jugador, largada grupal 3·2·1 (beep+vibración), play/stop
  independiente, vueltas sin frenar el reloj, meta de vueltas (al marcar la
  última el cronómetro se para solo), orden de llegada en vivo, comparación
  instantánea vs historial (récord 🏆 / ▲▼), deshacer último toque y pantalla
  siempre encendida (Wake Lock). Al guardar, los tiempos van SOLOS a la
  jornada de pruebas de HOY (se crea si no existe) → ficha, evolución, stats
  y Excel sin carga manual. La tanda en marcha sobrevive cierres/recargas
  (se persiste en `pc_ui` y el tiempo se calcula contra la hora real).

## Cómo se construye (misma receta que las otras apps de Julio)

- **PWA de un solo archivo**: todo en `index.html` (HTML + CSS + JS vanilla,
  sin frameworks ni build). Igual que StockMerger y Presupuestos AR.
- **Offline-first**: `sw.js` (HTML network-first, resto cache-first, con
  versión de cache que se sube en cada release) + `manifest.webmanifest`
  para instalarla en el teléfono.
- **Datos locales**: `localStorage` para el estado (objeto global `S` con
  claves centralizadas), respaldado por IndexedDB si crece (fotos, historial
  largo). Sin login ni backend en la etapa inicial.
- **Backup**: exportar/importar TODO como un archivo JSON desde el día uno.
  (Más adelante se puede sumar nube tipo Supabase o Google Drive, opt-in.)
- **Deploy**: Worker `pruevacero` en Cloudflare (assets estáticos,
  `wrangler.jsonc` con `assets.directory: "."`), conectado al repo de
  GitHub; **mergear a `main` publica solo** →
  `https://pruevacero.juliobarribolbo.workers.dev`.
- **Pantalla**: pensada para celular primero (el entrenador la usa en la
  cancha), con tema claro/oscuro como las otras apps.

## Modelo de datos (resumen)

```
team = { id, nombre, escudoId?,          // escudo en IndexedDB (getPhoto)
         categorias?: [{ id, nombre, desde, hasta,     // rango de años de nacimiento
                         dias?: [0-6, ...], hora?: 'HH:MM' }] }  // días/hora de clase (0=Do)
// La categoría de un jugador se deriva: playerCat(team, player) busca la
// categoría cuyo rango contiene su año de nacimiento; sin match se muestra
// el año tal cual. Los partidos pueden fijar `categoria` (id) y el plantel
// de la planilla se filtra solo.

attendance = [ {                 // una lista de asistencia por (equipo, categoría, fecha)
  id, teamId, catId|null, fecha,
  marks: { [playerId]: 'P'|'A'|'L' }   // presente / ausente / lesionado
} ]
// El % de asistencia = P/(P+A) — los días lesionado no bajan el %.
// Pestaña 🗓️ Clases: botón "lista de HOY" + abrir cualquier fecha pasada
// (crea o edita, sin duplicar: attFind por equipo+cat+fecha).

player = {
  id, teamId,                                          // equipo actual
  nombre, apellido, nacimiento (fecha completa),       // año => categoría
  desdeTemporada?,                                     // temporada de ingreso al club (texto libre: "2024" o "2024/25")
  fotoId?,                                             // foto en IndexedDB
  lateralidad: { pie, mano, ojo },
  fisico: { peso: [{fecha, kg}], altura: [{fecha, cm}] },  // con historial
  antecedentes: { aniosPractica, otrosDeportes: [texto] },
  posicion: { linea: 'arquero'|'defensor'|'medio'|'atacante',
              rol:   'central'|'lateral'|'centroatacante'|'extremo'|
                     'recuperacion'|'recuperacion_der'|'recuperacion_izq'|
                     'creacion'|'creacion_der'|'creacion_izq'|null,
              otros: ['linea:rol', …],      // versatilidad (multiposición)
              preferida: 'linea:rol'|'' },  // donde se siente más cómodo
  historialEquipos: [{teamId, desde, hasta}],          // se llena al mover
  lesiones: [{fecha, tipo, diasBaja, notas}],          // etapa 7
  objetivos: [{texto, creado, cumplido?}],             // etapa 7
  notas
}

testDef = {                    // CREADOR DE PRUEBAS (definición reutilizable)
  id, nombre,                  // "Sprint 30 m", "Fuerza piernas", ...
  unidad,                      // kg | seg | cm | m | nivel | reps | texto libre
  tipo: 'numero'|'tiempo'|'texto',
  mejorEs: 'mayor'|'menor',    // para marcar récords y flechas de progreso
  descripcion?, archivada?
}
// Precargadas: fuerza piernas/pecho/espalda (kg), 1000 m (tiempo),
// Yo-Yo (nivel), sprint 10 m y 30 m (seg), flexibilidad de tobillo (cm),
// salto en largo y salto en alto (cm).

testSession = {                // una "jornada de pruebas" de un equipo
  id, teamId, fecha,
  pruebas: [testDefId, ...],   // qué se midió ese día
  resultados: { [playerId]: { [testDefId]: valor } },
  vueltas?: { [playerId]: { [testDefId]: [seg, ...] } }  // parciales del ⏱ Crono
}

// GRUPOS DE RENDIMIENTO (derivados; solo se guarda la config)
S.grupos = [{ id, nombre, color }, x3]   // 3 grupos globales, nombre+color editables
testDef.grupos = {                        // cómo cortar ESA prueba en grupos
  modo: 'auto'|'umbral',                  // auto = tercios del plantel; umbral = rangos fijos
  cortes?: [v1, v2]                       // 2 cortes en la unidad de la prueba (seg si tiempo)
}
// El grupo de un jugador NO se guarda: se deriva de su última marca
// (grLabelFor / grIndexOf / grAssignAuto). mejorEs define qué extremo es "mejor".

match = {                      // shape REAL implementado en Etapa 3
  id, teamId, fecha, rival,
  golesFavor, golesContra,     // resultado (null = sin cargar)
  duracion,                    // minutos del partido (editable, def. 60)
  titulares: [playerId, ...],
  cambios: [{min, sale, entra}],
  stats: { [playerId]: { g, a, am, r, fc, fr } }
  // g goles · a asistencias · am amarillas (máx 2) · r roja (máx 1)
  // fc faltas cometidas · fr faltas recibidas
  // Los MINUTOS JUGADOS no se guardan: se derivan de titulares +
  // cambios + duración (helper minutosDe(match, playerId)).
}

evaluation = {                 // shape REAL implementado en Etapa 8
  id, teamId, playerId, fecha,
  scores: { [aspectId]: 1-10 }
}
exercise = {                   // ejercicio de la pizarra táctica (Etapa 12)
  id, teamId, creado, nombre, descripcion, materiales,
  categoria: catId|null,       // categoría a la que apunta el ejercicio
  jugadores: [playerId, ...],  // participantes
  carga: { dur, series, reps, pasada, descanso, intensidad },
  // dur en min; pasada/descanso en seg; la DENSIDAD (trabajo:descanso) se
  // deriva de pasada/descanso, no se guarda. intensidad: baja|media|alta|maxima
  plan: { dia (0-6|null), micro, etapa },  // etapa: acumulacion|transformacion|realizacion
  board: {                     // lo dibujado en la cancha (viewBox 68×105)
    view: 'chips'|'figs',      // chapitas o figuras de jugador
    tokens: [{ id, kind:'A'|'B'|'ball', num, x, y }],
    zones:  [{ id, shape:'rect'|'circle'|'tri', x, y, w, h, color }]
  }
}

evalAspects = [{ id, nombre, archivada? }]   // aspectos configurables
// (9 precargados: pase, control, gambeta, definición, cabezazo, velocidad,
// visión, marca, actitud). Radar en canvas propio (drawRadar, sin librerías)
// en la ficha: última evaluación vs promedio de la categoría (catAvgScores:
// última evaluación de cada compañero de la misma categoría — o mismo año
// si el equipo no define categorías; requiere >= 2 evaluados).
```

Las categorías (2010, 2011, …) se **derivan del año de nacimiento**, no se
cargan a mano. Peso y altura se guardan con fecha (historial de crecimiento).

## Estructura de la app

- **Selector de equipo** siempre visible arriba (crear/editar equipos desde
  ahí). Todo lo demás muestra datos del equipo activo.
- Pestañas:
  1. **👤 Jugadores** — lista con buscador y filtros por categoría/posición.
     Ficha completa + botones "Mover de equipo" y "Exportar ficha".
  2. **💪 Pruebas** — jornadas de prueba + **creador de pruebas** (gestor de
     `testDef`). Planilla rápida de carga por jugador. En la ficha se ve la
     evolución de cada prueba (mejor marca, última, gráfico simple).
  3. **⏱ Crono** — cronómetro grupal: participantes por categoría o manual,
     largada 3·2·1, vueltas, meta de vueltas, orden de llegada; guarda solo
     en la jornada de pruebas de hoy.
  4. **⚽ Partidos** — planilla de partido: titulares, cambios (minuto,
     entra/sale — los minutos salen solos), goles, asistencias,
     amarillas/rojas, faltas cometidas y recibidas.
  5. **📊 Estadísticas** — por jugador y por equipo: partidos y minutos,
     goles/asistencias (total y por partido), tarjetas y faltas por partido
     (ej. "una amarilla cada 3 partidos"), tabla comparativa ordenable.
  6. **📋 Pizarra** — pizarra táctica para planificar ejercicios de
     entrenamiento: cancha con dos equipos + pelota (arrastrables), zonas
     sombreadas, vista chapitas/figuras, y ficha completa del ejercicio
     (descripción, materiales, participantes, dosificación, periodización).
  7. **⚙️ Config** — equipos, backup JSON, exportes, tema (botón en header).

## Etapas de implementación

| Etapa | Contenido | Estado |
|---|---|---|
| 0 | Esqueleto de deploy (wrangler.jsonc + placeholder) y conexión del Worker `pruevacero` en Cloudflare | HECHA (2026-07-05) |
| 1 | PWA real (sw.js + manifest + tema claro/oscuro) + **Equipos** + pestaña Jugadores completa (con mover/exportar) + backup JSON básico | HECHA (2026-07-05) |
| 2 | Pestaña Pruebas: **creador de pruebas** + jornadas + planilla de carga + evolución en la ficha | HECHA (2026-07-05) |
| 3 | Pestaña Partidos (planilla con cambios y eventos) | HECHA (2026-07-05) |
| 4 | Pestaña Estadísticas (promedios, porcentajes, comparativa ordenable + resumen 📊 en la ficha) | HECHA (2026-07-06) |
| 5 | Exportes Excel con autofiltro (jugadores, estadísticas y jornada de pruebas; SheetJS por CDN) | HECHA (2026-07-06) |
| 6 | **Categorías dentro del equipo** (rango de años, partidos por categoría, filtro en Jugadores) + **escudo del club** + **foto por jugador** (IndexedDB `pruevacero_photos`, viajan en backup y ficha exportada) | HECHA (2026-07-06) |
| 7 | **Asistencia a entrenamientos** (pestaña 🗓️ Clases: por equipo+categoría, días/horas de clase editables en la categoría, lista de HOY accesible, edición retroactiva, % de asistencia y resumen en la ficha) | HECHA (2026-07-06) |
| 8 | Evaluación técnica/táctica 1–10 con **gráfico de radar** + comparación contra promedio de la categoría (aspectos configurables, en la ficha) | HECHA (2026-07-06) |
| ⏱ | **Cronómetro grupal** (pestaña ⏱ Crono, pedido 2026-07-07): participantes por categoría/manual, largada 3·2·1 con beep/vibración, play/stop individual, vueltas + meta de vueltas, orden de llegada, comparación vs historial, deshacer, Wake Lock; guarda solo en la jornada de HOY (campo `vueltas` en testSession) | HECHA (2026-07-07) |
| 9 | Historial de lesiones + objetivos por jugador (en la ficha: alta/borrar lesiones con fecha/tipo/días/notas; objetivos con cumplido/pendiente) | HECHA (2026-07-07) |
| 10 | Informe PDF del jugador (ficha + foto + pruebas + radar + estadísticas + asistencia + lesiones + objetivos, jsPDF por CDN) | HECHA (2026-07-07) |
| 11 | **Menú de posiciones ampliado**: medio suma "por derecha" y "por izquierda"; **Otros puestos** (multiposición, checkboxes) y **Posición preferida** (donde se siente cómodo) en la ficha/form y en el Excel | HECHA (2026-07-10) |
| 12 | **Pizarra táctica — base** (pestaña 📋 Pizarra, pedido 2026-07-12): cancha SVG con dos equipos + pelota arrastrables, vista chapitas/figuras, zonas sombreadas (cuadrado/rectángulo/círculo/triángulo, movibles y con tamaño/color editables) y ficha del ejercicio: nombre, descripción, materiales, categoría + jugadores participantes, dosificación (duración, series, reps, pasada, descanso, intensidad, densidad derivada) y planificación (día, microciclo, etapa acumulación/transformación/realización) | HECHA (2026-07-12) |
| 13 | **Pizarra táctica — animación**: pasos clave (fotogramas en `board.frames`, migración automática de ejercicios viejos) + ▶ Play con movimiento suave (interpolación con easing, rAF) | HECHA (2026-07-12) |
| 14 | **Pizarra táctica — video y pulido**: 🎥 exportar la animación como video WebM (canvas + `captureStream` + `MediaRecorder`, dibuja la misma escena en canvas), ⧉ duplicar ejercicio, y tarjeta "Ejercicios planificados para hoy" en la pestaña Clases (por día de la semana del ejercicio) | HECHA (2026-07-12) |

Fuera de alcance: video-análisis y GPS (hardware/servicios pagos).

### Pizarra táctica (pedido de Julio 2026-07-12, plan en 3 tandas)

Julio pidió una pizarra táctica animada para planificar entrenamientos, con:
dos equipos + pelota, vista figuras/chapitas, zonas sombreadas automáticas
(cuadrado/rectángulo/triángulo/círculo) para espacios reducidos sin dibujar
conos, animaciones (videos de ejercicios), documentación del ejercicio
(nombre, descripción, materiales, participantes + categoría), dosificación
(duración total, series y repeticiones, tiempo de pasadas, intensidad,
densidad trabajo/descanso) y periodización (día de la semana, microciclo,
etapa acumulación/transformación/realización).

Acordado: se implementó TODO en vanilla (sin librerías de dibujo), en 3
etapas: **12** pizarra base + ficha del ejercicio, **13** animación por
fotogramas clave con Play, **14** exportar video WebM + duplicar + tarjeta
"ejercicios de hoy" en Clases. **Las 3 HECHAS el 2026-07-12.** El módulo es
`js/board.js` (funciones `pz*`/`ex*`), los ejercicios viven en `S.exercises`
y entran al backup como el resto del estado.

Detalles técnicos de la animación/video (Etapas 13-14):
- `board.frames = [{ pos: { [tokenId]: {x, y} } }]`; el paso seleccionado
  (`pzFrame`) es la verdad y los `tokens.x/y` lo espejan (`pzStorePos` /
  `pzLoadPos`). Las zonas NO se animan (quedan fijas). Ejercicios de la
  Etapa 12 sin `frames` se migran solos al abrirlos (su posición = paso 1).
- Play: interpolación entre pasos con easing suavizado (`pzEase`,
  1,2 s por transición, `PZ_SEG_MS`) actualizando `transform` de los `<g>`
  por rAF; mientras reproduce se bloquea el arrastre y la edición de pasos.
- Video: `pzCanvasDraw` redibuja la MISMA escena en un canvas (544×840),
  `canvas.captureStream(30)` + `MediaRecorder` → descarga `.webm`. Con un
  solo paso avisa que faltan pasos; si el navegador no soporta
  MediaRecorder (iOS viejos) avisa con toast. OJO tests: rAF casi no corre
  bajo `--virtual-time-budget` → en los tests el reloj del Play se maneja
  llamando `pzTick(t)` a mano.

### Pedidos de Julio del 2026-07-06 (detalle para las etapas 6 y 7)

- **Categorías dentro de un mismo equipo**: un equipo (club) tiene varias
  categorías y cada categoría juega partidos contra rivales de SU categoría.
  La categoría del jugador ya se deriva del año de nacimiento; falta:
  asignar categoría a los PARTIDOS (para filtrar el plantel al armar la
  planilla) y filtros por categoría en jugadores/pruebas/estadísticas.
  **Confirmado por Julio (2026-07-06)**: la categoría por defecto es el año
  de nacimiento, pero debe ser EDITABLE como rango de años (ej. una
  categoría mayor que admite nacidos "entre 2005 y 2007"). Modelo tentativo:
  el equipo define sus categorías `{ id, nombre, desdeAnio, hastaAnio }` y
  el jugador cae solo en la que corresponde por su año (con override manual
  si hiciera falta).
- **Escudo del club**: imagen opcional por equipo (guardar en IndexedDB,
  mismo patrón de fotos que las otras apps; localStorage no aguanta imágenes).
- **Foto por jugador (pedido 2026-07-06)**: en vez de las iniciales, poder
  ponerle una foto a cada jugador para verle la cara (avatar en la lista y
  en la ficha). Guardar en IndexedDB (patrón `pq_photos` de Presupuestos AR:
  el registro guarda un ID y el binario vive en IDB); incluirlas en el
  backup y en la ficha exportada del jugador.
- **Asistencia** (reemplaza la idea genérica anterior):
  - Presente/ausente por CLASE (entrenamiento), no solo por fecha suelta.
  - Cada categoría tiene sus **días y horas de clase**, editables.
  - Al pasar lista: elegir equipo y categoría → botón directo con la clase
    de HOY (según los días/horas configurados).
  - Aunque no se haya pasado lista ese día, se puede **cargar o editar una
    fecha pasada** (por si no se usó la app en el momento).
  - El % de asistencia se usa como referencia para decidir titularidad.

### Etapas 9 y 10 (implementadas 2026-07-07)

- **Lesiones y objetivos (Etapa 9)**: en la ficha, dos tarjetas nuevas.
  Lesiones (`p.lesiones`): alta con fecha/tipo/días de baja/notas, se ordenan
  por fecha, muestran total de días de baja; borrar con confirmación.
  Objetivos (`p.objetivos`): alta con el prompt propio, tocar ⭕/✅ marca
  cumplido (guarda la fecha), borrar con confirmación. Ambos campos ya
  existían vacíos en el shape del jugador desde la Etapa 1.
- **Informe PDF (Etapa 10)**: botón "📄 Informe PDF" en la ficha (junto a
  Exportar ficha). Usa **jsPDF 2.5.1 por CDN** (cdnjs, con SRI), misma
  estrategia que el Excel: necesita internet la PRIMERA vez y después queda
  cacheado por el SW. Arma un A4 con datos personales, foto, pruebas físicas
  (última + mejor marca), partidos, asistencia, evaluación técnica con el
  radar (se rasteriza el canvas en tema claro y se inserta como PNG),
  lesiones, objetivos y notas. Sin emojis dentro del PDF (helvetica).
- **Rediseño del PDF para lectura rápida (2026-07-07, pedido de Julio)**: el
  informe se rearmó para "escanear con el ojo". Partidos y asistencia van en
  *tiles* (número grande + etiqueta); el % de asistencia se colorea por umbral
  (verde ≥80, ámbar ≥60, rojo <60). Pruebas físicas en tabla con filas
  alternadas, la mejor marca en verde con etiqueta RÉCORD cuando la última es
  la mejor, y flecha de tendencia (▲ verde mejoró / ▼ rojo empeoró) vs la marca
  anterior. Evaluación con barra por aspecto (puntaje verde + línea azul del
  promedio de la categoría) además del radar. Lesiones con viñeta roja y días
  de baja en ámbar; objetivos con cuadrito verde (cumplido) / ámbar
  (pendiente). Pie con numeración de página. Helpers `_pdfTiles`,
  `_pdfDataGrid`, `_pdfTri` en `js/pdf.js`.

### Grupos de rendimiento y benchmarking (2026-07-08, pedido de Julio)

Botón "🎨 Grupos de rendimiento" en la pestaña Pruebas (`js/groups.js`,
overlay `ovGrupos`). Todo DERIVADO de los resultados; lo único guardado es la
config (`S.grupos` global + `testDef.grupos` por prueba).

- **Segmentación en 3 grupos** por prueba, en dos modos: **automático** (parte
  el plantel en tercios) o **por rangos fijos** (2 cortes en min:seg/número que
  define el profe). Aplica a cualquier prueba numérica/tiempo (respeta
  `mejorEs`).
- **Colores + nombres editables** (`ovGruposCfg`), default Verde/Azul/Rojo. Se
  muestran solo por color y nombre, nunca como "nivel", para no jerarquizar.
- **Filtros** por categoría y por posición.
- **Subió/bajó de grupo** vs la jornada anterior (flechita).
- **Benchmarking por posición** (toggle "Por posición"): mejor y más flojo de
  cada línea + promedio.
- **Armar equipos parejos** (2–4) por reparto serpiente sobre el rendimiento,
  para picados de entrenamiento equilibrados.
- Integración con el ⏱ Crono: al guardar, si la prueba tiene rangos por
  umbral, avisa el grupo de cada jugador.

Ideas para 2ª tanda (no implementadas aún): percentil dentro de la categoría,
elegir 2–4 grupos, grupos en el PDF, cruces con lesiones/asistencia, objetivo
automático para el grupo más flojo.

## PENDIENTES — próxima sesión (anotado 2026-07-08, pedido de Julio)

> Julio pidió 3 cosas (anotadas 2026-07-08). **Las 3 quedaron HECHAS el
> 2026-07-09**: 1 (botón de Config al header), 2 (bug del lápiz) y 3 (app
> instalable). Detalle de cada una abajo.

### 1. ✅ HECHO (2026-07-09) — Botón de Config al header + tema en Config
- El **⚙️ Configuración pasó al header** (donde estaba el 🌙), hace
  `switchTab('config')`.
- Se quitó `#nav-config` de la barra inferior → **6 pestañas**.
- El toggle de tema quedó **solo en la tarjeta Apariencia** de Config
  (`#themeToggleBtn`, ahora muestra el modo actual). `applyTheme` ya no toca
  `#themeBtn` (eliminado); actualiza `#themeToggleBtn` con guarda contra null.

### 2. ✅ HECHO (2026-07-09) — BUG del botón editar (lápiz)
Síntoma: al tocar el lápiz ✏️ en la ficha "no hacía nada"; recién al tocar
"volver atrás" entraba en la edición.

Causa: `ovPlayerForm` está antes que `ovFicha` en el DOM y todos los `.overlay`
compartían `z-index:30`; `fichaEdit()` abría el form sin cerrar la ficha, así
que la ficha (posterior en el DOM) tapaba al form.

Arreglo aplicado (opción a, general): `openOverlay(id)` ahora le da al overlay
que se abre un `z-index` por encima de los ya abiertos (`31 + nº de overlays
abiertos`, tope 44 para no pisar la cuenta regresiva del crono `45` ni los
modales `50`); `closeOverlay` limpia el `z-index` inline. Sirve para cualquier
caso de overlay-sobre-overlay, no solo el lápiz.

### 3. ✅ HECHO (2026-07-09) — App instalable (PWA)
- Metas `apple-mobile-web-app-*` (pantalla completa / título / status bar) +
  `mobile-web-app-capable` para iOS.
- Módulo `js/pwa.js`: captura `beforeinstallprompt`, muestra el botón
  **"📲 Instalar app"** en la tarjeta Config y lo oculta tras `appinstalled`.
  Ayuda contextual (`refreshInstallCard`): botón real en Android/Chrome,
  "Compartir → Agregar a inicio" en iOS/Safari, "ya está instalada" en modo
  standalone.
