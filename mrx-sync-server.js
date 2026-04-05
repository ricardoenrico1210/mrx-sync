// mrx-sync-server.js – Render.com ready
const http = require('http');
const PORT = process.env.PORT || 3000;

let syncStore = null;
let lastPush = null;
let pushCount = 0;

function setCORS(res, origin) {
  const ok = !origin || origin.endsWith('.github.io') || ['http://localhost:3000','http://localhost:5500','http://127.0.0.1:5500','null'].includes(origin);
  res.setHeader('Access-Control-Allow-Origin', ok ? (origin||'*') : 'null');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function json(res, status, data) {
  res.writeHead(status, {'Content-Type':'application/json'});
  res.end(JSON.stringify(data));
}

http.createServer((req, res) => {
  const origin = req.headers.origin || '';
  setCORS(res, origin);
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  const url = req.url.split('?')[0];

  if (url === '/ping' || url === '/health') {
    json(res, 200, {ok:true, hasData:!!syncStore, lastPush, pushCount, time:new Date().toISOString()});
    return;
  }
  if (url === '/sync' && req.method === 'GET') {
    json(res, 200, syncStore || {empty:true});
    return;
  }
  if (url === '/sync' && req.method === 'POST') {
    let body = '';
    req.on('data', c => { body += c; if(body.length > 10e6) req.destroy(); });
    req.on('end', () => {
      try {
        const d = JSON.parse(body);
        if (!d.iv || !d.data) { json(res, 400, {error:'Bad format'}); return; }
        syncStore = d; lastPush = new Date().toISOString(); pushCount++;
        json(res, 200, {ok:true, saved:lastPush});
      } catch(e) { json(res, 400, {error:e.message}); }
    });
    return;
  }
  if (url === '/') {
    res.writeHead(200, {'Content-Type':'text/html;charset=utf-8'});
    res.end(`<!DOCTYPE html><html><head><title>MRX Sync</title>
<style>body{font-family:system-ui;max-width:480px;margin:60px auto;padding:20px;background:#0f0f1a;color:#e0e0f0}h1{color:#1d9e75}code{background:#1c1c2e;padding:3px 9px;border-radius:5px}</style></head>
<body><h1>✦ MRX-Vision Sync</h1>
<p style="color:#1d9e75">● Läuft</p>
<p style="color:#9090b0">Daten: ${syncStore?'✓':'–'} | Letzter Sync: ${lastPush||'–'} | Total: ${pushCount}</p>
<hr style="border-color:#222">
<code>GET /ping</code> – Health<br><br>
<code>GET /sync</code> – Abrufen<br><br>
<code>POST /sync</code> – Hochladen</body></html>`);
    return;
  }
  json(res, 404, {error:'Not found'});
}).listen(PORT, () => console.log(`✦ MRX Sync läuft: http://localhost:${PORT}`));
