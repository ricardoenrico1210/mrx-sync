// mrx-sync-server.js v2 – Render.com ready
// Kein externer Salt nötig – beide Partner nutzen gleichen SHARED_SALT im Client
const http = require('http');
const PORT = process.env.PORT || 3000;

let syncStore = null;
let lastPush = null;
let pushCount = 0;

function setCORS(res) {
  // Alle Origins erlauben – die Sicherheit liegt in der AES-Verschlüsselung, nicht im CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function json(res, status, data) {
  setCORS(res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

const server = http.createServer((req, res) => {
  setCORS(res);

  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = req.url.split('?')[0];

  // Health Check – für UptimeRobot (hält Server wach) & App "Testen" Button
  if (url === '/ping' || url === '/health' || url === '/') {
    json(res, 200, {
      ok: true,
      server: 'MRX-Vision Sync v2',
      hasData: !!syncStore,
      lastPush,
      pushCount,
      time: new Date().toISOString(),
      message: syncStore ? 'Daten verfügbar' : 'Noch keine Daten'
    });
    return;
  }

  // GET /sync – aktuellen verschlüsselten Stand abrufen
  if (url === '/sync' && req.method === 'GET') {
    if (!syncStore) {
      json(res, 200, { empty: true });
    } else {
      json(res, 200, syncStore);
    }
    return;
  }

  // POST /sync – verschlüsselten Stand hochladen
  if (url === '/sync' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 15 * 1024 * 1024) { // 15MB limit
        req.destroy();
        json(res, 413, { error: 'Zu groß' });
      }
    });
    req.on('end', () => {
      try {
        const d = JSON.parse(body);
        if (!d.iv || !d.data) {
          json(res, 400, { error: 'Ungültiges Format – iv und data erwartet' });
          return;
        }
        syncStore = d;
        lastPush = new Date().toISOString();
        pushCount++;
        console.log(`[${lastPush}] Sync #${pushCount} empfangen`);
        json(res, 200, { ok: true, saved: lastPush, pushCount });
      } catch (e) {
        json(res, 400, { error: 'JSON Fehler: ' + e.message });
      }
    });
    req.on('error', () => {});
    return;
  }

  json(res, 404, { error: 'Nicht gefunden', routes: ['GET /ping', 'GET /sync', 'POST /sync'] });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✦ MRX-Vision Sync Server v2`);
  console.log(`  Port: ${PORT}`);
  console.log(`  Bereit für Verbindungen`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Server wird beendet…');
  server.close(() => process.exit(0));
});
