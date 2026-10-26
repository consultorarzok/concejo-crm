/** Ejecuta SQL (DDL o SELECT) contra Supabase Pierre vía workflow temporal de n8n. Uso: node sql-admin.js -f archivo.sql | "SQL" */
const fs = require('fs');
const API = 'https://n8n.consultorarz.com/api/v1';
const KEY = JSON.parse(fs.readFileSync('/root/.claude.json', 'utf8')).projects['/root'].mcpServers['n8n-mcp'].env.N8N_API_KEY;
const h = { 'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const sql = (process.argv[2] === '-f' ? fs.readFileSync(process.argv[3], 'utf8') : process.argv[2]).replace(/[\r\n]+/g, ' ');
  const PATH = `crmadm-${Date.now()}`;
  const wf = { name: 'TEMP - CRM admin SQL', settings: { executionOrder: 'v1' },
    nodes: [
      { id: 'trg', name: 'Disparar', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [0, 0], parameters: { httpMethod: 'POST', path: PATH, options: {} }, webhookId: PATH },
      { id: 'q', name: 'Query', type: 'n8n-nodes-base.postgres', typeVersion: 2.6, position: [220, 0], alwaysOutputData: true,
        parameters: { resource: 'database', operation: 'executeQuery', query: sql, options: {} },
        credentials: { postgres: { id: '9DJNCWmV7V4NRKz2', name: 'Supabase Pierre' } } }],
    connections: { Disparar: { main: [[{ node: 'Query', type: 'main', index: 0 }]] } } };
  let id;
  try {
    id = (await (await fetch(`${API}/workflows`, { method: 'POST', headers: h, body: JSON.stringify(wf) })).json()).id;
    await fetch(`${API}/workflows/${id}/activate`, { method: 'POST', headers: h });
    await sleep(3000);
    await fetch(`https://n8n.consultorarz.com/webhook/${PATH}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    await sleep(6000);
    const ex = await (await fetch(`${API}/executions?workflowId=${id}&limit=1&includeData=true`, { headers: h })).json();
    const rd = ex.data?.[0]?.data?.resultData;
    const out = rd?.runData?.Query?.[0]?.data?.main?.[0];
    console.log(out ? JSON.stringify(out.map((i) => i.json)).slice(0, 1500) : '✗ error: ' + JSON.stringify(rd?.error || {}).slice(0, 800));
  } finally {
    if (id) { await fetch(`${API}/workflows/${id}/deactivate`, { method: 'POST', headers: h }).catch(() => {}); await fetch(`${API}/workflows/${id}`, { method: 'DELETE', headers: h });
      console.error('🧹 temporal borrado:', (await fetch(`${API}/workflows/${id}`, { headers: h })).status === 404 ? '✓' : '✗ REVISAR ' + id); }
  }
})().catch((e) => { console.error('✗', e.message); process.exit(1); });
