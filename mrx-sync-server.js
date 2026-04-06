// mrx-sync-server.js v3
const http = require('http');
const PORT = process.env.PORT || 3000;

let syncStore = null;
let lastPush = null;
let pushCount = 0;

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function json(res, status, data) {
  setCORS(res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

const PAGE = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>MRX-Vision Sync</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,'Segoe UI',sans-serif;background:#0b0b12;color:#e0e0f0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
  .card{background:#0f0f1a;border:1px solid #1c1c2e;border-radius:20px;padding:36px 32px;max-width:420px;width:100%;text-align:center}
  .logo{width:56px;height:56px;background:#1d9e75;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:24px;margin:0 auto 16px;box-shadow:0 8px 24px rgba(29,158,117,.3)}
  h1{font-size:22px;font-weight:800;margin-bottom:4px;letter-spacing:-.5px}
  .sub{font-size:13px;color:#5a5a78;margin-bottom:28px}
  .stat{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:#141420;border-radius:10px;margin-bottom:8px}
  .stat-label{font-size:12px;color:#9090b0;font-weight:600}
  .stat-val{font-size:13px;font-weight:700;color:#e0e0f0;font-family:'Courier New',monospace}
  .dot{width:8px;height:8px;border-radius:50%;background:#1d9e75;display:inline-block;margin-right:6px;animation:pulse 2s infinite}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
  .status-row{display:flex;align-items:center;justify-content:center;gap:6px;font-size:13px;color:#1d9e75;font-weight:700;margin-bottom:24px}
  .footer{font-size:11px;color:#3c3c5a;margin-top:20px;line-height:1.6}
  .enc{background:#1c1c2e;border:1px solid #262638;border-radius:8px;padding:10px 14px;font-size:11.5px;color:#6666a0;margin-top:16px;line-height:1.7;text-align:left}
  .enc b{color:#9090b0}
</style>
</head>
<body>
<div class="card">
  <div class="logo">✦</div>
  <h1>MRX-Vision</h1>
  <p class="sub">Workspace Sync Server</p>
  <div class="status-row"><span class="dot"></span> Server läuft</div>
  <div class="stat"><span class="stat-label">Status</span><span class="stat-val" id="hasData">Laden…</span></div>
  <div class="stat"><span class="stat-label">Letzter Sync</span><span class="stat-val" id="lastPush">–</span></div>
  <div class="stat"><span class="stat-label">Syncs gesamt</span><span class="stat-val" id="pushCount">–</span></div>
  <div class="stat"><span class="stat-label">Serverzeit</span><span class="stat-val" id="time">–</span></div>
  <div class="enc">
    <b>🔐 End-to-End verschlüsselt</b><br>
    Alle Daten sind AES-256-GCM verschlüsselt.<br>
    Dieser Server sieht ausschließlich verschlüsselte Blobs.
  </div>
  <p class="footer">mrx-sync.onrender.com · Nur für MRX-Vision Team</p>
</div>
<script>
async function load(){
  try{
    const r=await fetch('/ping');
    const d=await r.json();
    document.getElementById('hasData').textContent=d.hasData?'✓ Daten vorhanden':'Noch leer';
    document.getElementById('lastPush').textContent=d.lastPush?d.lastPush.replace('T',' ').substring(0,19)+' UTC':'–';
    document.getElementById('pushCount').textContent=d.pushCount||'0';
    document.getElementById('time').textContent=new Date(d.time).toLocaleTimeString('de-AT');
  }catch(e){document.getElementById('hasData').textContent='Fehler';}
}
load();
setInterval(load,10000);
</script>
</body>
</html>`;

http.createServer((req, res) => {
  setCORS(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  const url = req.url.split('?')[0];

  if (url === '/' || url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(PAGE);
    return;
  }
  if (url === '/ping' || url === '/health') {
    json(res, 200, { ok:true, server:'MRX-Vision Sync v3', hasData:!!syncStore, lastPush, pushCount, time:new Date().toISOString() });
    return;
  }
  if (url === '/sync' && req.method === 'GET') {
    json(res, 200, syncStore || { empty:true });
    return;
  }
  if (url === '/sync' && req.method === 'POST') {
    let body = '';
    req.on('data', c => { body += c; if(body.length > 15e6) req.destroy(); });
    req.on('end', () => {
      try {
        const d = JSON.parse(body);
        if (!d.iv || !d.data) { json(res, 400, { error:'Bad format' }); return; }
        syncStore = d; lastPush = new Date().toISOString(); pushCount++;
        console.log(`[${lastPush}] Sync #${pushCount}`);
        json(res, 200, { ok:true, saved:lastPush, pushCount });
      } catch(e) { json(res, 400, { error:e.message }); }
    });
    return;
  }
  json(res, 404, { error:'Not found' });
}).listen(PORT, '0.0.0.0', () => console.log(`✦ MRX Sync v3 · Port ${PORT}`));
process.on('SIGTERM', () => process.exit(0));
