CREATE TABLE IF NOT EXISTS concejo_crm_contactos (
  telefono text PRIMARY KEY,
  nombre text,
  atencion text NOT NULL DEFAULT 'no_atendido' CHECK (atencion IN ('no_atendido','seguimiento','atendido')),
  atendido_por text,
  atendido_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS concejo_crm_notas (
  id bigserial PRIMARY KEY,
  telefono text NOT NULL,
  autor text,
  texto text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_concejo_crm_notas_tel ON concejo_crm_notas (telefono, id DESC);
CREATE TABLE IF NOT EXISTS concejo_crm_usuarios (
  usuario text PRIMARY KEY,
  pass_hash text NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS concejo_crm_sesiones (
  token text PRIMARY KEY,
  usuario text NOT NULL,
  expira timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_concejo_conv_tel ON concejo_conversaciones (telefono, id);
CREATE INDEX IF NOT EXISTS idx_concejo_conv_fecha ON concejo_conversaciones (created_at);
CREATE OR REPLACE VIEW concejo_crm_v AS
SELECT c.telefono,
  COALESCE(NULLIF(k.nombre,''), NULLIF(v.nombre,''), d.nombre_der) AS nombre,
  NULLIF(v.barrio,'') AS barrio,
  -- 27/10/2026 (Zeta): a todos los atiende el agente -> "Atendido" por defecto. Pasa a "Sin atender" si hubo una
  -- derivacion o el agente no pudo resolver (pe), salvo que una persona del equipo lo haya marcado despues.
  -- La ultima accion manda: marca del equipo (atendido_at) vs ultimo pendiente (pe.ult).
  CASE WHEN k.atendido_at IS NOT NULL AND (pe.ult IS NULL OR k.atendido_at >= pe.ult) THEN k.atencion
       WHEN pe.ult IS NOT NULL THEN 'no_atendido' ELSE 'atendido' END AS atencion,
  CASE WHEN k.atendido_at IS NOT NULL AND (pe.ult IS NULL OR k.atendido_at >= pe.ult) THEN k.atendido_por
       WHEN pe.ult IS NULL THEN 'Agente IA' END AS atendido_por,
  CASE WHEN k.atendido_at IS NOT NULL AND (pe.ult IS NULL OR k.atendido_at >= pe.ult) THEN k.atendido_at
       WHEN pe.ult IS NULL THEN c.ultimo END AS atendido_at,
  c.msgs, c.adjuntos, c.primero, c.ultimo, COALESCE(c.tema,'Otras consultas') AS tema,
  (c.telefono ~ '^(549000|5493883299927$)') AS es_prueba,
  COALESCE(d.n,0)::int AS derivs, d.ult_deriv, d.motivo,
  COALESCE(p.n,0)::int AS propuestas, COALESCE(m.n,0)::int AS mediaciones, COALESCE(o.n,0)::int AS ordenanzas,
  (pe.ult IS NOT NULL AND (k.atendido_at IS NULL OR pe.ult > k.atendido_at)) AS volvio,
  pe.ult AS pend_at,
  CASE WHEN length(trim(coalesce(pe.msg,''))) >= 15 THEN pe.msg
       ELSE COALESCE((SELECT x.mensaje_usuario FROM concejo_conversaciones x WHERE x.telefono = c.telefono AND x.created_at <= pe.ult
                      AND length(trim(x.mensaje_usuario)) >= 15 ORDER BY x.created_at DESC LIMIT 1), pe.msg) END AS pend_msg,
  pe.motivo AS pend_motivo
FROM (
  SELECT telefono, count(*) AS msgs, count(*) FILTER (WHERE tipo_mensaje <> 'text') AS adjuntos,
    min(created_at) AS primero, max(created_at) AS ultimo,
    CASE
      WHEN bool_or(mensaje_usuario ~* 'buz[oó]n|propuest|proponer|tu norma') THEN 'Propuesta / Buzón'
      WHEN bool_or(mensaje_usuario ~* 'mediaci|conflicto|me amenaz|pelea') THEN 'Mediación'
      WHEN bool_or(mensaje_usuario ~* 'audiencia|banca abierta|stand') THEN 'Audiencia / participación'
      WHEN bool_or(mensaje_usuario ~* 'ordenanza|est[aá] permitido|se puede') THEN 'Ordenanzas'
      WHEN bool_or(mensaje_usuario ~* 'concejal|bloque') THEN 'Concejales'
      WHEN bool_or(mensaje_usuario ~* 'comisi') THEN 'Comisiones'
      WHEN bool_or(mensaje_usuario ~* 'sesi[oó]n|sesiona') THEN 'Sesiones'
      WHEN bool_or(mensaje_usuario ~* 'vecinal') THEN 'Centros vecinales'
      WHEN bool_or(mensaje_usuario ~* 'bache|luminaria|alumbrado|basura|cloaca|residuos') THEN 'Reclamos del Municipio'
      WHEN bool_or(mensaje_usuario ~* 'colectivo|l[ií]nea|transporte') THEN 'Colectivos'
    END AS tema
  FROM concejo_conversaciones GROUP BY telefono
) c
LEFT JOIN concejo_crm_contactos k ON k.telefono = c.telefono
LEFT JOIN concejo_vecinos v ON v.telefono = c.telefono
LEFT JOIN (
  SELECT "Telefono" AS telefono, count(*) AS n, max(created_at) AS ult_deriv,
    (array_agg("Nombre" ORDER BY created_at DESC) FILTER (WHERE "Nombre" IS NOT NULL AND "Nombre" <> '' AND "Nombre" NOT ILIKE 'sin nombre'))[1] AS nombre_der,
    (array_agg("Motivo" ORDER BY created_at DESC))[1] AS motivo
  FROM concejo_derivaciones GROUP BY 1
) d ON d.telefono = c.telefono
LEFT JOIN (SELECT telefono, count(*) AS n FROM concejo_propuestas_normativas GROUP BY 1) p ON p.telefono = c.telefono
LEFT JOIN (SELECT telefono, count(*) AS n FROM concejo_mediaciones GROUP BY 1) m ON m.telefono = c.telefono
LEFT JOIN (SELECT "Telefono" AS telefono, count(*) AS n FROM concejo_ordenanzas_consultadas GROUP BY 1) o ON o.telefono = c.telefono
-- pendientes: derivaciones + respuestas donde el agente no pudo resolver (mismo criterio que Auditoria) o paso a Coordinacion
LEFT JOIN (
  SELECT telefono, max(created_at) AS ult,
    COALESCE((array_agg(msg ORDER BY created_at DESC) FILTER (WHERE length(trim(msg)) >= 15))[1], (array_agg(msg ORDER BY created_at DESC))[1]) AS msg, (array_agg(motivo ORDER BY created_at DESC))[1] AS motivo
  FROM (
    SELECT telefono, created_at, mensaje_usuario AS msg, 'El agente no pudo resolver' AS motivo FROM concejo_conversaciones
    WHERE translate(lower(respuesta_ai),'áéíóúüñ','aeiouun') ~ '(no tengo (esa |esos |ese )?(informacion|dato)|no lo tengo (cargado|confirmado)|no tengo cargad|no figura|todavia no (fue|fueron) informad|no (esta|estan) publicad|wa\.me/5493885042325)'
    UNION ALL
    SELECT "Telefono", created_at, "Consulta", 'Derivación' FROM concejo_derivaciones
  ) x GROUP BY telefono
) pe ON pe.telefono = c.telefono;
