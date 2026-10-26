# CRM Concejo Deliberante SSJ

CRM interno del Asistente Virtual del Concejo Deliberante de San Salvador de Jujuy (WhatsApp +54 9 388 587-3361).

- **Front:** HTML/CSS/JS estático (sin build), Chart.js. Marca: Manual CD Jujuy. Celeste `#1f9cb5` + blanco predominan; rojo `#e42a20`, naranja `#f29e1d`, amarillo `#ece31b` y gris `#939598` (rombos del logo) solo como acento; tipografía Creato Display (fallback Helvetica/Arial).
- **Datos:** Supabase (tablas `concejo_*` del agente) a través de la API `Concejo CRM API` en n8n (`POST /webhook/concejo-crm-api`, acciones `login`, `stats`, `list`, `detail`, `save`, `note`, `derivs`, `buzon`, `ords`). Todas exigen sesión (token) salvo `login`.
- **Pestañas:** Resumen · Vecinos · Derivados · Buzón · Ordenanzas · Manual de marca. Filtro por mes (hora de Jujuy) y los números de prueba (`549000…`) ocultos por defecto.
- **Escrituras:** solo en `concejo_crm_contactos` (atención/nombre) y `concejo_crm_notas`. Las tablas del agente no se modifican.
- **Backend:** `backend/db.sql` (tablas, índices y vista `concejo_crm_v`), `backend/build-api.js` (crea/actualiza el workflow en n8n) y `backend/sql-admin.js` (ejecuta SQL). La clave de acceso vive en `backend/.clave-concejo` (no se sube).

Publicar: `git push` (GitHub Pages desde `/`).
