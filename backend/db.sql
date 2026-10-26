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
  COALESCE(k.atencion,'no_atendido') AS atencion, k.atendido_por, k.atendido_at,
  c.msgs, c.adjuntos, c.primero, c.ultimo, COALESCE(c.tema,'Otras consultas') AS tema,
  (c.telefono ~ '^549000') AS es_prueba,
  COALESCE(d.n,0)::int AS derivs, d.ult_deriv, d.motivo,
  COALESCE(p.n,0)::int AS propuestas, COALESCE(m.n,0)::int AS mediaciones, COALESCE(o.n,0)::int AS ordenanzas
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
LEFT JOIN (SELECT "Telefono" AS telefono, count(*) AS n FROM concejo_ordenanzas_consultadas GROUP BY 1) o ON o.telefono = c.telefono;
