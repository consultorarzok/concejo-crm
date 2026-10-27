/** Crea/actualiza el workflow "Concejo CRM API" en n8n (webhook único POST text/plain con {action,...}). Lee Supabase (concejo_*). */
const fs = require('fs');
const API = 'https://n8n.consultorarz.com/api/v1';
const KEY = JSON.parse(fs.readFileSync('/root/.claude.json', 'utf8')).projects['/root'].mcpServers['n8n-mcp'].env.N8N_API_KEY;
const h = { 'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json' };
const CRED = { postgres: { id: '9DJNCWmV7V4NRKz2', name: 'Supabase Pierre' } };
const PATH = 'concejo-crm-api';
const NAME = 'Concejo CRM API';

const parse = `
const raw = $input.first().json.body;
let b = {};
try { b = typeof raw === 'string' ? JSON.parse(raw) : (raw || {}); } catch (e) { b = {}; }
const s = (v, n = 500) => String(v == null ? '' : v).trim().slice(0, n);
const tel = s(b.telefono, 30).replace(/\\D/g, '');
const ATEN = ['no_atendido', 'seguimiento', 'atendido'];
const FIL = ['todos', 'no_atendido', 'seguimiento', 'atendido', 'derivado', 'propuesta', 'mediacion', 'ordenanza'];
const size = Math.min(Math.max(parseInt(b.size) || 50, 1), 200);
const page = Math.max(parseInt(b.page) || 0, 0);
const mes = /^20\\d\\d-(0[1-9]|1[0-2])$/.test(b.mes) ? b.mes : '';
let desde = '2000-01-01T00:00:00Z', hasta = '2100-01-01T00:00:00Z';
if (mes) { const [y, m] = mes.split('-').map(Number); desde = mes + '-01T00:00:00-03:00'; hasta = (m === 12 ? y + 1 : y) + '-' + String(m === 12 ? 1 : m + 1).padStart(2, '0') + '-01T00:00:00-03:00'; }
return [{ json: {
  action: s(b.action, 20), token: s(b.token, 80).replace(/[^a-f0-9]/g, ''),
  usuario: s(b.usuario, 40).toLowerCase(), clave: s(b.clave, 100),
  p: {
    q: s(b.q, 80), filtro: FIL.includes(b.filtro) ? b.filtro : 'todos', tema: s(b.tema, 60),
    orden: b.orden === 'antiguos' ? 'antiguos' : 'recientes', limit: size, offset: page * size, mes, desde, hasta,
    pruebas: b.pruebas === true, tipo: s(b.tipo, 20),
    telefono: tel, nombre: s(b.nombre, 80), atencion: ATEN.includes(b.atencion) ? b.atencion : 'no_atendido',
    por: s(b.por, 60), hasNombre: b.nombre !== undefined, hasAtencion: ATEN.includes(b.atencion), texto: s(b.texto, 2000)
  } } }];`;

/* Todas las consultas reciben: mes/desde/hasta y pruebas (true = incluir teléfonos de prueba 549000…) */
const SQL = {
  list: `WITH a0 AS (SELECT * FROM concejo_crm_v v WHERE ($9::boolean OR NOT v.es_prueba)
  AND ($6 = '' OR v.telefono IN (SELECT DISTINCT x.telefono FROM concejo_conversaciones x WHERE x.created_at >= $7::timestamptz AND x.created_at < $8::timestamptz))),
f AS (SELECT * FROM a0 WHERE ($1 = '' OR telefono ILIKE '%' || $1 || '%' OR nombre ILIKE '%' || $1 || '%' OR barrio ILIKE '%' || $1 || '%')
  AND ($2 = 'todos' OR ($2 = 'no_atendido' AND atencion = 'no_atendido') OR ($2 = 'seguimiento' AND atencion = 'seguimiento') OR ($2 = 'atendido' AND atencion = 'atendido')
    OR ($2 = 'derivado' AND derivs > 0) OR ($2 = 'propuesta' AND propuestas > 0) OR ($2 = 'mediacion' AND mediaciones > 0) OR ($2 = 'ordenanza' AND ordenanzas > 0)))
SELECT json_build_object(
 'total', (SELECT count(*) FROM f),
 'counts', (SELECT json_build_object('todos', count(*), 'no_atendido', count(*) FILTER (WHERE atencion = 'no_atendido'), 'seguimiento', count(*) FILTER (WHERE atencion = 'seguimiento'), 'atendido', count(*) FILTER (WHERE atencion = 'atendido'), 'derivado', count(*) FILTER (WHERE derivs > 0), 'propuesta', count(*) FILTER (WHERE propuestas > 0), 'mediacion', count(*) FILTER (WHERE mediaciones > 0), 'ordenanza', count(*) FILTER (WHERE ordenanzas > 0)) FROM a0),
 'rows', (SELECT COALESCE(json_agg(t), '[]'::json) FROM (
   SELECT f.telefono, f.nombre, f.barrio, f.atencion, f.atendido_por, f.atendido_at, f.tema, f.msgs, f.adjuntos, f.primero, f.ultimo, f.derivs, f.propuestas, f.mediaciones, f.ordenanzas, f.es_prueba, f.volvio, f.pend_at, f.pend_msg, f.pend_motivo,
     (SELECT left(CASE WHEN x.tipo_mensaje IN ('text', 'audio') THEN COALESCE(NULLIF(x.mensaje_usuario, ''), '[' || x.tipo_mensaje || ']') ELSE '[' || x.tipo_mensaje || ']' END, 110) FROM concejo_conversaciones x WHERE x.telefono = f.telefono ORDER BY x.id DESC LIMIT 1) AS ultimo_msg
   FROM f ORDER BY CASE WHEN $3 = 'antiguos' THEN f.ultimo END ASC, CASE WHEN $3 <> 'antiguos' THEN f.ultimo END DESC LIMIT $4 OFFSET $5) t)
) AS data`,
  detail: `SELECT json_build_object(
 'contacto', (SELECT row_to_json(v) FROM concejo_crm_v v WHERE v.telefono = $1),
 'mensajes', (SELECT COALESCE(json_agg(m ORDER BY m.id), '[]'::json) FROM (SELECT id, tipo_mensaje, mensaje_usuario, respuesta_ai, NULLIF(categoria_imagen, '') AS categoria_imagen, created_at FROM concejo_conversaciones WHERE telefono = $1 ORDER BY id DESC LIMIT 300) m),
 'notas', (SELECT COALESCE(json_agg(n ORDER BY n.id DESC), '[]'::json) FROM concejo_crm_notas n WHERE n.telefono = $1),
 'derivaciones', (SELECT COALESCE(json_agg(x), '[]'::json) FROM (SELECT "Consulta" AS consulta, "Motivo" AS motivo, "Origen" AS origen, created_at FROM concejo_derivaciones WHERE "Telefono" = $1 ORDER BY created_at DESC LIMIT 10) x),
 'propuestas', (SELECT COALESCE(json_agg(x), '[]'::json) FROM (SELECT fecha, barrio, problema, norma_propuesta, estado_revision FROM concejo_propuestas_normativas WHERE telefono = $1 ORDER BY id DESC LIMIT 10) x),
 'mediaciones', (SELECT COALESCE(json_agg(x), '[]'::json) FROM (SELECT fecha, tipo_conflicto, detalle, derivado_a, estado FROM concejo_mediaciones WHERE telefono = $1 ORDER BY id DESC LIMIT 10) x),
 'ordenanzas', (SELECT COALESCE(json_agg(x), '[]'::json) FROM (SELECT "Fecha" AS fecha, "Numero_Ordenanza" AS numero FROM concejo_ordenanzas_consultadas WHERE "Telefono" = $1 ORDER BY id DESC LIMIT 20) x)
) AS data`,
  save: `WITH r AS (
 INSERT INTO concejo_crm_contactos AS o (telefono, nombre, atencion, atendido_por, atendido_at, updated_at)
 VALUES ($1, CASE WHEN $5::boolean THEN NULLIF($2, '') END, CASE WHEN $6::boolean THEN $3 ELSE 'no_atendido' END,
   CASE WHEN $6::boolean AND $3 <> 'no_atendido' THEN NULLIF($4, '') END, CASE WHEN $6::boolean THEN now() END, now())
 ON CONFLICT (telefono) DO UPDATE SET
   nombre = CASE WHEN $5::boolean THEN NULLIF($2, '') ELSE o.nombre END,
   atencion = CASE WHEN $6::boolean THEN $3 ELSE o.atencion END,
   atendido_por = CASE WHEN NOT $6::boolean THEN o.atendido_por WHEN $3 = 'no_atendido' THEN NULL ELSE COALESCE(NULLIF($4, ''), o.atendido_por) END,
   atendido_at = CASE WHEN NOT $6::boolean THEN o.atendido_at ELSE now() END,  -- toda marca del equipo (incluso "Sin atender") queda fechada: la vista compara contra el ultimo pendiente
   updated_at = now()
 RETURNING o.telefono, o.nombre, o.atencion, o.atendido_por, o.atendido_at)
SELECT row_to_json(r) AS data FROM r`,
  note: `WITH r AS (INSERT INTO concejo_crm_notas (telefono, autor, texto) VALUES ($1, NULLIF($2, ''), $3) RETURNING id, telefono, autor, texto, created_at) SELECT row_to_json(r) AS data FROM r`,
  /* Derivaciones a Coordinación + Mediaciones + Audiencias, en una sola lista */
  derivs: `WITH u AS (
 SELECT 'coordinacion' AS tipo, d.id, d."Telefono" AS telefono, NULLIF(NULLIF(d."Nombre", 'Sin nombre'), '') AS nombre, NULLIF(d."Barrio", '') AS barrio, d."Consulta" AS detalle, d."Motivo" AS motivo, d.created_at AS cuando FROM concejo_derivaciones d
 UNION ALL
 SELECT 'mediacion', m.id, m.telefono, NULLIF(m.nombre, ''), NULLIF(m.barrio, ''), m.detalle, 'Mediación: ' || COALESCE(m.tipo_conflicto, '') || ' → ' || COALESCE(m.derivado_a, ''), CASE WHEN m.fecha ~ '^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}' THEN m.fecha::timestamp AT TIME ZONE 'America/Argentina/Jujuy' END FROM concejo_mediaciones m
 UNION ALL
 SELECT 'audiencia', g.id, g.telefono, NULLIF(g.nombre, ''), NULL, g.concejal_o_area || COALESCE(' · ' || g.fecha_solicitada, ''), 'Audiencia: ' || COALESCE(g.tipo, ''), CASE WHEN g.fecha_registro ~ '^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}' THEN g.fecha_registro::timestamp AT TIME ZONE 'America/Argentina/Jujuy' END FROM concejo_agendamientos g)
SELECT COALESCE(json_agg(t), '[]'::json) AS data FROM (
 SELECT u.tipo, u.id, u.telefono, COALESCE(NULLIF(k.nombre, ''), u.nombre) AS nombre, u.barrio, u.detalle, u.motivo, u.cuando, CASE WHEN k.atendido_at IS NOT NULL AND k.atendido_at >= u.cuando THEN k.atencion ELSE 'no_atendido' END AS atencion, (u.telefono ~ '^(549000|5493883299927$)') AS es_prueba
 FROM u LEFT JOIN concejo_crm_contactos k ON k.telefono = u.telefono
 WHERE ($4::boolean OR u.telefono !~ '^(549000|5493883299927$)') AND ($1 = '' OR (u.cuando >= $2::timestamptz AND u.cuando < $3::timestamptz)) ORDER BY u.cuando DESC NULLS LAST LIMIT 1000) t`,
  buzon: `SELECT COALESCE(json_agg(t), '[]'::json) AS data FROM (
 SELECT p.id, p.fecha, p.telefono, COALESCE(NULLIF(k.nombre, ''), NULLIF(p.nombre, '')) AS nombre, NULLIF(p.barrio, '') AS barrio, p.problema, p.norma_propuesta, p.estado_revision, COALESCE(k.atencion, 'no_atendido') AS atencion, (p.telefono ~ '^(549000|5493883299927$)') AS es_prueba
 FROM concejo_propuestas_normativas p LEFT JOIN concejo_crm_contactos k ON k.telefono = p.telefono
 WHERE ($4::boolean OR p.telefono !~ '^(549000|5493883299927$)') AND ($1 = '' OR left(p.fecha, 7) = $1) ORDER BY p.id DESC LIMIT 1000) t`,
  ords: `SELECT json_build_object(
 'ranking', (SELECT COALESCE(json_agg(r), '[]'::json) FROM (SELECT "Numero_Ordenanza" AS numero, count(*) AS n, count(DISTINCT "Telefono") AS vecinos, max("Fecha") AS ultima FROM concejo_ordenanzas_consultadas
   WHERE ($3::boolean OR "Telefono" !~ '^(549000|5493883299927$)') AND ($1 = '' OR left("Fecha", 7) = $1) GROUP BY 1 ORDER BY 2 DESC, 4 DESC LIMIT 100) r),
 'recientes', (SELECT COALESCE(json_agg(x), '[]'::json) FROM (SELECT o.id, o."Fecha" AS fecha, o."Telefono" AS telefono, o."Numero_Ordenanza" AS numero, COALESCE(NULLIF(k.nombre, ''), NULLIF(v.nombre, '')) AS nombre
   FROM concejo_ordenanzas_consultadas o LEFT JOIN concejo_crm_contactos k ON k.telefono = o."Telefono" LEFT JOIN concejo_vecinos v ON v.telefono = o."Telefono"
   WHERE ($3::boolean OR o."Telefono" !~ '^(549000|5493883299927$)') AND ($1 = '' OR left(o."Fecha", 7) = $1) ORDER BY o.id DESC LIMIT 100) x)
) AS data`,
  audit: `WITH m AS (SELECT telefono, created_at, mensaje_usuario, respuesta_ai,
   lower(translate(coalesce(mensaje_usuario, ''), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')) AS q,
   lower(translate(coalesce(respuesta_ai, ''), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')) AS r
   FROM concejo_conversaciones WHERE tipo_mensaje = 'text' AND ($4::boolean OR telefono !~ '^(549000|5493883299927$)')),
t AS (SELECT m.*, CASE
   WHEN q ~ 'buzon|propuest|proponer|tu norma' THEN 'Propuestas / Buzón'
   WHEN q ~ 'mediaci|conflicto|me amenaz|pelea' THEN 'Mediación'
   WHEN q ~ 'audiencia|banca abierta|stand' THEN 'Audiencias y participación'
   WHEN q ~ 'ordenanza|esta permitido|se puede|norma' THEN 'Ordenanzas'
   WHEN q ~ 'concejal|bloque|presidente|autoridad' THEN 'Concejales y autoridades'
   WHEN q ~ 'comision' THEN 'Comisiones'
   WHEN q ~ 'sesion|sesiona' THEN 'Sesiones'
   WHEN q ~ 'vecinal' THEN 'Centros vecinales'
   WHEN q ~ 'bache|luminaria|alumbrado|basura|cloaca|residuos' THEN 'Reclamos del Municipio'
   WHEN q ~ 'colectivo|linea|transporte' THEN 'Colectivos'
   WHEN q ~ 'horario|direccion|donde queda|donde esta' THEN 'Horarios y ubicación'
   WHEN length(q) < 25 THEN 'Saludos y mensajes cortos'
   ELSE 'Otras consultas' END AS tema,
  CASE
   WHEN r ~ 'no es una funcion del concejo' THEN 'Aclara que no es función del Concejo'
   WHEN r ~ 'no tengo (esa )?informacion|no lo tengo cargado|no tengo cargad|no figura' THEN 'Dice que no tiene la información'
   WHEN r ~ 'apartidario|opiniones politicas' THEN 'Se declara apartidario'
   WHEN r ~ '911|emergencia' THEN 'Pasa números de emergencia'
   WHEN r ~ 'mediacion' THEN 'Explica la Mediación'
   WHEN r ~ 'buzon' THEN 'Ofrece el Buzón «Tu norma, tu ciudad»'
   WHEN r ~ 'coordinacion general|5042325|wa\\.me' THEN 'Pasa el contacto de Coordinación'
   WHEN r ~ 'buscador|digesto|ordenanza' THEN 'Orienta sobre ordenanzas / buscadores'
   WHEN r ~ 'concejal|bloque|comision|presid' THEN 'Informa de concejales o comisiones'
   WHEN r ~ 'sesion' THEN 'Informa de sesiones'
   WHEN r ~ 'puedo ayudarte con' THEN 'Saluda y presenta el menú'
   ELSE 'Otras respuestas' END AS tipo_resp
  FROM m),
tp AS (SELECT * FROM t WHERE $1::text IS NOT NULL AND created_at >= $2::timestamptz AND created_at < $3::timestamptz),
c AS (SELECT "Nombre_Completo" AS n, "Bloque" AS b, lower(translate(substring(trim("Nombre_Completo") from '(\\S+)$'), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')) AS ap FROM concejo_cache_concejales)
SELECT json_build_object(
 'mensajes', (SELECT count(*) FROM tp),
 'vecinos', (SELECT count(DISTINCT telefono) FROM tp),
 'no_supo', (SELECT count(*) FROM tp WHERE tipo_resp = 'Dice que no tiene la información'),
 'temas', (SELECT COALESCE(json_agg(x), '[]'::json) FROM (SELECT tema AS label, count(*) AS n, count(DISTINCT telefono) AS vecinos FROM tp GROUP BY 1 ORDER BY 2 DESC) x),
 'respuestas', (SELECT COALESCE(json_agg(x), '[]'::json) FROM (SELECT tipo_resp AS label, count(*) AS n FROM tp GROUP BY 1 ORDER BY 2 DESC) x),
 'concejales', (SELECT COALESCE(json_agg(x), '[]'::json) FROM (
   SELECT c.n AS nombre, c.b AS bloque, count(*) AS n, count(DISTINCT tp.telefono) AS vecinos, (array_agg(left(tp.mensaje_usuario, 140) ORDER BY tp.created_at DESC))[1:3] AS ejemplos
   FROM c JOIN tp ON tp.q ~ ('\\m' || c.ap || '\\M') GROUP BY 1, 2 ORDER BY 3 DESC, 4 DESC LIMIT 20) x),
 'repetidas', (SELECT COALESCE(json_agg(x), '[]'::json) FROM (
   SELECT (array_agg(left(mensaje_usuario, 140) ORDER BY created_at DESC))[1] AS pregunta, count(*) AS n, count(DISTINCT telefono) AS vecinos, mode() WITHIN GROUP (ORDER BY tipo_resp) AS respuesta
   FROM tp WHERE length(q) >= 12 GROUP BY regexp_replace(q, '[^a-z0-9 ]', '', 'g') HAVING count(*) >= 2 ORDER BY 2 DESC, 3 DESC LIMIT 15) x),
 'sin_respuesta', (SELECT COALESCE(json_agg(x), '[]'::json) FROM (
   SELECT left(mensaje_usuario, 160) AS pregunta, left(respuesta_ai, 220) AS respuesta, created_at FROM tp WHERE tipo_resp = 'Dice que no tiene la información' ORDER BY created_at DESC LIMIT 12) x),
 'meses', (SELECT COALESCE(json_agg(x ORDER BY x.mes), '[]'::json) FROM (
   SELECT to_char(created_at AT TIME ZONE 'America/Argentina/Jujuy', 'YYYY-MM') AS mes, count(*) AS mensajes, count(DISTINCT telefono) AS vecinos,
     count(*) FILTER (WHERE tipo_resp = 'Dice que no tiene la información') AS no_supo,
     count(*) FILTER (WHERE tema = 'Ordenanzas') AS ordenanzas, count(*) FILTER (WHERE tema = 'Concejales y autoridades') AS concejales
   FROM t GROUP BY 1) x)
) AS data`,
  stats: `WITH ts AS (SELECT telefono FROM concejo_conversaciones WHERE created_at >= $2::timestamptz AND created_at < $3::timestamptz AND ($4::boolean OR telefono !~ '^(549000|5493883299927$)') GROUP BY telefono),
a AS (SELECT v.* FROM concejo_crm_v v WHERE ($4::boolean OR NOT v.es_prueba) AND ($1 = '' OR v.telefono IN (SELECT telefono FROM ts)))
SELECT json_build_object(
 'vecinos', (SELECT count(*) FROM a),
 'mensajes', (SELECT count(*) FROM concejo_conversaciones WHERE created_at >= $2::timestamptz AND created_at < $3::timestamptz AND ($4::boolean OR telefono !~ '^(549000|5493883299927$)')),
 'derivaciones', (SELECT count(*) FROM concejo_derivaciones WHERE ($4::boolean OR "Telefono" !~ '^(549000|5493883299927$)') AND ($1 = '' OR (created_at >= $2::timestamptz AND created_at < $3::timestamptz))),
 'mediaciones', (SELECT count(*) FROM concejo_mediaciones WHERE ($4::boolean OR telefono !~ '^(549000|5493883299927$)') AND ($1 = '' OR left(fecha, 7) = $1)),
 'propuestas', (SELECT count(*) FROM concejo_propuestas_normativas WHERE ($4::boolean OR telefono !~ '^(549000|5493883299927$)') AND ($1 = '' OR left(fecha, 7) = $1)),
 'ordenanzas', (SELECT count(*) FROM concejo_ordenanzas_consultadas WHERE ($4::boolean OR "Telefono" !~ '^(549000|5493883299927$)') AND ($1 = '' OR left("Fecha", 7) = $1)),
 'sin_atender', (SELECT count(*) FROM a WHERE atencion = 'no_atendido' AND (derivs > 0 OR propuestas > 0 OR mediaciones > 0)),
 'atendidos', (SELECT count(*) FROM a WHERE atencion = 'atendido'),
 'pruebas_ocultas', (SELECT count(*) FROM concejo_crm_v WHERE es_prueba),
 'meses', (SELECT COALESCE(json_agg(m ORDER BY m.mes), '[]'::json) FROM (SELECT to_char(created_at AT TIME ZONE 'America/Argentina/Jujuy', 'YYYY-MM') AS mes, count(*) AS mensajes, count(DISTINCT telefono) AS vecinos FROM concejo_conversaciones WHERE ($4::boolean OR telefono !~ '^(549000|5493883299927$)') GROUP BY 1) m),
 'diario', (SELECT COALESCE(json_agg(d ORDER BY d.dia), '[]'::json) FROM (SELECT (created_at AT TIME ZONE 'America/Argentina/Jujuy')::date AS dia, count(*) AS mensajes, count(DISTINCT telefono) AS vecinos FROM concejo_conversaciones WHERE $1 <> '' AND created_at >= $2::timestamptz AND created_at < $3::timestamptz AND ($4::boolean OR telefono !~ '^(549000|5493883299927$)') GROUP BY 1) d),
 'horas', (SELECT COALESCE(json_agg(x ORDER BY x.hora), '[]'::json) FROM (SELECT extract(hour FROM created_at AT TIME ZONE 'America/Argentina/Jujuy')::int AS hora, count(*) AS n FROM concejo_conversaciones WHERE created_at >= $2::timestamptz AND created_at < $3::timestamptz AND ($4::boolean OR telefono !~ '^(549000|5493883299927$)') GROUP BY 1) x),
 'temas', (SELECT COALESCE(json_agg(c), '[]'::json) FROM (SELECT tema, count(*) AS n FROM a GROUP BY 1 ORDER BY 2 DESC) c),
 'tipos', (SELECT COALESCE(json_agg(t), '[]'::json) FROM (SELECT tipo_mensaje AS tipo, count(*) AS n FROM concejo_conversaciones WHERE created_at >= $2::timestamptz AND created_at < $3::timestamptz AND ($4::boolean OR telefono !~ '^(549000|5493883299927$)') GROUP BY 1 ORDER BY 2 DESC) t)
) AS data`,
};
const P = '$("Parsear").first().json';
const MD = `${P}.p.mes, ${P}.p.desde, ${P}.p.hasta, ${P}.p.pruebas`;
const REPL = {
  list: `={{ [${P}.p.q, ${P}.p.filtro, ${P}.p.orden, ${P}.p.limit, ${P}.p.offset, ${P}.p.mes, ${P}.p.desde, ${P}.p.hasta, ${P}.p.pruebas] }}`,
  derivs: `={{ [${MD}] }}`,
  buzon: `={{ [${MD}] }}`,
  ords: `={{ [${P}.p.mes, ${P}.p.desde, ${P}.p.pruebas] }}`,
  stats: `={{ [${MD}] }}`,
  audit: `={{ [${MD}] }}`,
  detail: `={{ [${P}.p.telefono] }}`,
  save: `={{ [${P}.p.telefono, ${P}.p.nombre, ${P}.p.atencion, ${P}.p.por, ${P}.p.hasNombre, ${P}.p.hasAtencion] }}`,
  note: `={{ [${P}.p.telefono, ${P}.p.por, ${P}.p.texto] }}`,
};
const actions = Object.keys(SQL);
const CORS = { entries: [{ name: 'Access-Control-Allow-Origin', value: '*' }] };
const nodes = [
  { id: 'wh', name: 'Webhook', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [0, 300], webhookId: PATH,
    parameters: { httpMethod: 'POST', path: PATH, responseMode: 'responseNode', options: { allowedOrigins: '*' } } },
  { id: 'pa', name: 'Parsear', type: 'n8n-nodes-base.code', typeVersion: 2, position: [220, 300], parameters: { jsCode: parse } },
  { id: 'sw', name: 'Accion', type: 'n8n-nodes-base.switch', typeVersion: 3.2, position: [440, 300],
    parameters: { rules: { values: actions.map((a) => ({ renameOutput: true, outputKey: a,
      conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, combinator: 'and',
        conditions: [{ id: a, leftValue: `={{ ${P}.action }}`, rightValue: a, operator: { type: 'string', operation: 'equals' } }] } })) },
      options: { fallbackOutput: 'extra', renameFallbackOutput: 'desconocida' } } },
  { id: 'rs', name: 'Responder', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [1000, 300],
    parameters: { respondWith: 'json', responseBody: '={{ $json.data !== undefined ? $json.data : { error: "sin datos" } }}', options: { responseHeaders: CORS } } },
  { id: 're', name: 'Responder error', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [1000, 700],
    parameters: { respondWith: 'json', responseBody: '={{ { error: "accion desconocida" } }}', options: { responseCode: 400, responseHeaders: CORS } } },
];
const connections = { Accion: { main: [] } };
actions.forEach((a, i) => {
  const name = 'SQL ' + a;
  nodes.push({ id: 'q' + a, name, type: 'n8n-nodes-base.postgres', typeVersion: 2.6, position: [720, 40 + i * 90], alwaysOutputData: true, onError: 'continueRegularOutput',
    parameters: { resource: 'database', operation: 'executeQuery', query: SQL[a], options: { queryReplacement: REPL[a] } }, credentials: CRED });
  connections.Accion.main[i] = [{ node: name, type: 'main', index: 0 }];
  connections[name] = { main: [[{ node: 'Responder', type: 'main', index: 0 }]] };
});
connections.Accion.main[actions.length] = [{ node: 'Responder error', type: 'main', index: 0 }];
nodes.push(
  { id: 'iflog', name: 'Es login', type: 'n8n-nodes-base.if', typeVersion: 2.2, position: [440, 520],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, combinator: 'and',
      conditions: [{ id: 'l', leftValue: '={{ $json.action }}', rightValue: 'login', operator: { type: 'string', operation: 'equals' } }] }, options: {} } },
  { id: 'qlogin', name: 'SQL login', type: 'n8n-nodes-base.postgres', typeVersion: 2.6, position: [720, 820], alwaysOutputData: true, onError: 'continueRegularOutput',
    parameters: { resource: 'database', operation: 'executeQuery', options: { queryReplacement: `={{ [${P}.usuario, ${P}.clave] }}` },
      query: `WITH u AS (SELECT usuario FROM concejo_crm_usuarios WHERE usuario = $1 AND activo AND pass_hash = extensions.crypt($2, pass_hash)),
s AS (INSERT INTO concejo_crm_sesiones (token, usuario, expira) SELECT encode(extensions.gen_random_bytes(24), 'hex'), usuario, now() + interval '30 days' FROM u RETURNING token, usuario, expira),
d AS (DELETE FROM concejo_crm_sesiones WHERE expira < now())
SELECT COALESCE((SELECT row_to_json(s) FROM s), json_build_object('error', 'credenciales')) AS data` }, credentials: CRED },
  { id: 'qses', name: 'SQL sesion', type: 'n8n-nodes-base.postgres', typeVersion: 2.6, position: [720, 600], alwaysOutputData: true,
    parameters: { resource: 'database', operation: 'executeQuery', options: { queryReplacement: `={{ [${P}.token || 'x'] }}` },
      query: `SELECT EXISTS (SELECT 1 FROM concejo_crm_sesiones WHERE token = $1 AND expira > now()) AS ok` }, credentials: CRED },
  { id: 'ifses', name: 'Sesion valida', type: 'n8n-nodes-base.if', typeVersion: 2.2, position: [940, 600],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 }, combinator: 'and',
      conditions: [{ id: 's', leftValue: '={{ $json.ok }}', rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } }] }, options: {} } },
  { id: 'r401', name: 'Responder 401', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [1180, 760],
    parameters: { respondWith: 'json', responseBody: '={{ { error: "sesion" } }}', options: { responseCode: 401, responseHeaders: CORS } } },
);
connections.Webhook = { main: [[{ node: 'Parsear', type: 'main', index: 0 }]] };
connections.Parsear = { main: [[{ node: 'Es login', type: 'main', index: 0 }]] };
connections['Es login'] = { main: [[{ node: 'SQL login', type: 'main', index: 0 }], [{ node: 'SQL sesion', type: 'main', index: 0 }]] };
connections['SQL login'] = { main: [[{ node: 'Responder', type: 'main', index: 0 }]] };
connections['SQL sesion'] = { main: [[{ node: 'Sesion valida', type: 'main', index: 0 }]] };
connections['Sesion valida'] = { main: [[{ node: 'Accion', type: 'main', index: 0 }], [{ node: 'Responder 401', type: 'main', index: 0 }]] };

(async () => {
  const wf = { name: NAME, nodes, connections, settings: { executionOrder: 'v1' } };
  const list = await (await fetch(`${API}/workflows?limit=250`, { headers: h })).json();
  const ex = list.data.find((w) => w.name === NAME);
  let id;
  if (ex) { id = ex.id; const r = await fetch(`${API}/workflows/${id}`, { method: 'PUT', headers: h, body: JSON.stringify(wf) }); if (!r.ok) throw new Error(await r.text()); }
  else { const r = await fetch(`${API}/workflows`, { method: 'POST', headers: h, body: JSON.stringify(wf) }); const j = await r.json(); if (!r.ok) throw new Error(JSON.stringify(j)); id = j.id; }
  await fetch(`${API}/workflows/${id}/deactivate`, { method: 'POST', headers: h });
  const a = await fetch(`${API}/workflows/${id}/activate`, { method: 'POST', headers: h });
  console.log('workflow', id, ex ? 'actualizado' : 'creado', 'activate:', a.status);
})().catch((e) => { console.error('✗', e.message); process.exit(1); });
