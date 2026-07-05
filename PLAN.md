# Plan — App de análisis de jugadores (PruevaCero)

> Documento de arranque del proyecto. Acá está el plan acordado con Julio a
> partir de los audios del cuerpo técnico. Se implementa **por etapas**; al
> terminar cada etapa se marca como HECHA y se anota cualquier cambio de
> alcance.

## Qué es

App para que un cuerpo técnico de fútbol formativo lleve el **seguimiento de
sus jugadores**: ficha personal y biometría, pruebas físicas con historial,
posiciones, y estadísticas de partidos (minutos, goles, tarjetas, etc.) con
promedios automáticos.

## Cómo se construye (misma receta que las otras apps de Julio)

- **PWA de un solo archivo**: todo en `index.html` (HTML + CSS + JS vanilla,
  sin frameworks ni build). Igual que StockMerger y Presupuestos AR.
- **Offline-first**: `sw.js` (HTML network-first, resto cache-first, con
  `CACHE_VERSION` que se sube en cada release) + `manifest.webmanifest` para
  instalarla en el teléfono.
- **Datos locales**: `localStorage` para el estado (objeto global `S` con
  claves centralizadas), respaldado por IndexedDB si crece (fotos, historial
  largo). Sin login ni backend en la etapa inicial.
- **Backup**: exportar/importar TODO como un archivo JSON desde el día uno.
  (Más adelante se puede sumar nube tipo Supabase o Google Drive, opt-in,
  como en las otras apps.)
- **Deploy**: assets estáticos en Cloudflare; mergear a `main` publica solo.
- **Pantalla**: pensada para celular primero (el entrenador la usa en la
  cancha), con tema claro/oscuro como las otras apps.

## Modelo de datos (resumen)

```
player = {
  id, nombre, apellido, nacimiento (fecha completa),   // año => categoría
  fotoId?,                                             // foto en IndexedDB
  lateralidad: { pie, mano, ojo },
  fisico: { peso: [{fecha, kg}], altura: [{fecha, cm}] },   // con historial
  antecedentes: { aniosPractica, otrosDeportes: [texto] },
  posicion: { linea: 'arquero'|'defensor'|'medio'|'atacante',
              rol:   'central'|'lateral'|'recuperacion'|'creacion'|
                     'centroatacante'|'extremo'|null },
  notas
}

test = {                       // una "jornada de pruebas" con fecha
  id, fecha,
  resultados: { [playerId]: {
    fuerzaPiernas, fuerzaPecho, fuerzaEspalda,        // kg
    mil_metros,                                       // tiempo
    yoyo,                                             // nivel/dist (el "elo test" de los audios)
    sprint10, sprint30,                               // segundos
    flexTobillo,                                      // cm (lunge test)
    saltoLargo, saltoAlto                             // cm
  } }
}

match = {
  id, fecha, rival, categoria, resultado,
  jugadores: { [playerId]: {
    titular, minEntra, minSale,                       // minutos jugados
    goles, asistencias,
    amarillas, roja, faltasCometidas, faltasRecibidas
  } },
  cambios: [{min, sale, entra}]
}
```

Las categorías (2010, 2011, …) se **derivan del año de nacimiento**, no se
cargan a mano. Peso y altura se guardan con fecha (historial de crecimiento).

## Pestañas de la app

1. **👤 Jugadores** — lista con buscador y filtros por categoría/posición.
   Ficha completa: datos, lateralidad, peso/altura (con historial), años de
   práctica, otros deportes, posición (línea + rol), foto, notas.
2. **💪 Pruebas** — se crea una "jornada" con fecha y se cargan los
   resultados por jugador (planilla rápida: elegís la prueba y vas jugador
   por jugador). En la ficha del jugador se ve la **evolución** de cada
   prueba (mejor marca, última, gráfico simple).
3. **⚽ Partidos** — se crea el partido (rival, fecha, categoría), se marca
   el equipo, y se cargan los eventos: cambios (quién entra/sale, minuto),
   goles, asistencias, amarillas/rojas, faltas cometidas y recibidas. Los
   minutos jugados salen solos de titularidad + cambios.
4. **📊 Estadísticas** — por jugador y por categoría: partidos y minutos
   jugados, goles y asistencias (total y por partido), tarjetas y faltas por
   partido (ej. "una amarilla cada 3 partidos"), tabla comparativa del
   plantel ordenable por cualquier columna.
5. **⚙️ Config** — datos del club/categorías, exportar/importar backup JSON,
   exportar Excel.

## Etapas de implementación

| Etapa | Contenido | Estado |
|---|---|---|
| 1 | Esqueleto PWA (index.html + sw.js + manifest + deploy Cloudflare) + pestaña Jugadores completa | PENDIENTE |
| 2 | Pestaña Pruebas (jornadas + planilla de carga + evolución en la ficha) | PENDIENTE |
| 3 | Pestaña Partidos (planilla de partido con cambios y eventos) | PENDIENTE |
| 4 | Pestaña Estadísticas (promedios, porcentajes, comparativa) | PENDIENTE |
| 5 | Exportes (Excel con autofiltro, PDF de ficha del jugador) + pulido | PENDIENTE |

## Ideas extra (vistas en apps del rubro — a decidir con Julio)

Investigado en apps como TeamGenius, SkillShark, Playermaker, SoccerPulse,
SportEasy, bcoach y Planet Training:

- **Evaluación técnica/táctica con puntaje** (1–10 o 1–5) por rubro: pase,
  control, 1v1, cabezazo, visión, actitud… con **gráfico de radar** en la
  ficha. Es LO central de las apps de evaluación (TeamGenius, SkillShark).
- **Comparar jugador vs. promedio de su categoría** (percentiles por edad) —
  útil junto al año de nacimiento para el tema maduración.
- **Asistencia a entrenamientos** (presente/ausente/lesionado) con % de
  asistencia — lo tienen casi todas (SportEasy, bcoach).
- **Historial médico / lesiones** (fecha, tipo, tiempo de baja).
- **Objetivos por jugador** ("mejorar pierna izquierda") con seguimiento.
- **Informe PDF del jugador** para mostrarle a padres/club: ficha + pruebas +
  radar + estadísticas (misma librería jsPDF que usan las otras apps).
- **Multi-evaluador**: que dos entrenadores puntúen y se promedie (más
  adelante, requeriría nube).
- Video-análisis y GPS quedan AFUERA (hardware/costos, otro rubro de app).

## Decisiones de producto

> Mantener esta sección al día, como en los CLAUDE.md de las otras apps.

- El "elo test" de los audios se interpreta como **test Yo-Yo** (resistencia
  intermitente). Confirmar con el cuerpo técnico.
- (pendiente de completar a medida que Julio defina reglas)
