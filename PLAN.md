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
team = { id, nombre, club?, categoria?, color?, notas }

player = {
  id, teamId,                                          // equipo actual
  nombre, apellido, nacimiento (fecha completa),       // año => categoría
  fotoId?,                                             // foto en IndexedDB
  lateralidad: { pie, mano, ojo },
  fisico: { peso: [{fecha, kg}], altura: [{fecha, cm}] },  // con historial
  antecedentes: { aniosPractica, otrosDeportes: [texto] },
  posicion: { linea: 'arquero'|'defensor'|'medio'|'atacante',
              rol:   'central'|'lateral'|'recuperacion'|'creacion'|
                     'centroatacante'|'extremo'|null },
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
  resultados: { [playerId]: { [testDefId]: valor } }
}

match = {
  id, teamId, fecha, rival, categoria, resultado,
  jugadores: { [playerId]: {
    titular, minEntra, minSale,                        // minutos jugados
    goles, asistencias,
    amarillas, roja, faltasCometidas, faltasRecibidas
  } },
  cambios: [{min, sale, entra}]
}

evaluation = {                 // etapa 6: puntaje técnico/táctico
  id, teamId, playerId, fecha,
  puntajes: { pase, control, unoVsUno, cabezazo, vision, actitud, ... }  // 1–10
}
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
  3. **⚽ Partidos** — planilla de partido: titulares, cambios (minuto,
     entra/sale — los minutos salen solos), goles, asistencias,
     amarillas/rojas, faltas cometidas y recibidas.
  4. **📊 Estadísticas** — por jugador y por equipo: partidos y minutos,
     goles/asistencias (total y por partido), tarjetas y faltas por partido
     (ej. "una amarilla cada 3 partidos"), tabla comparativa ordenable.
  5. **⚙️ Config** — equipos, backup JSON, exportes, tema.

## Etapas de implementación

| Etapa | Contenido | Estado |
|---|---|---|
| 0 | Esqueleto de deploy (wrangler.jsonc + placeholder) y conexión del Worker `pruevacero` en Cloudflare | HECHA (2026-07-05) |
| 1 | PWA real (sw.js + manifest + tema claro/oscuro) + **Equipos** + pestaña Jugadores completa (con mover/exportar) + backup JSON básico | HECHA (2026-07-05) |
| 2 | Pestaña Pruebas: **creador de pruebas** + jornadas + planilla de carga + evolución en la ficha | PENDIENTE |
| 3 | Pestaña Partidos (planilla con cambios y eventos) | PENDIENTE |
| 4 | Pestaña Estadísticas (promedios, porcentajes, comparativa) | PENDIENTE |
| 5 | Backup JSON completo + exportes Excel con autofiltro | PENDIENTE |
| 6 | Evaluación técnica/táctica 1–10 con **gráfico de radar** + comparación contra promedio de la categoría | PENDIENTE |
| 7 | Asistencia a entrenamientos + historial de lesiones + objetivos por jugador | PENDIENTE |
| 8 | Informe PDF del jugador (ficha + pruebas + radar + estadísticas, jsPDF) | PENDIENTE |

Fuera de alcance: video-análisis y GPS (hardware/servicios pagos).
