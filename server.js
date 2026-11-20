// Local development server (not needed on GitHub Pages). No npm dependencies.
// The phone link itself goes through PeerJS; this only serves the two static pages:
//  - Laptop:  http://localhost:8080
//  - Phone:   https://<LAN-IP>:8443/remote.html   (HTTPS is required for phone motion sensors)
// Run with:  node server.js   (or npm run dev)
'use strict';
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const HTTP_PORT = Number(process.env.PORT) || 8080;
const HTTPS_PORT = Number(process.env.HTTPS_PORT) || 8443;
const IP = process.env.HOST_IP ||
  Object.values(os.networkInterfaces()).flat().find(a => a && a.family === 'IPv4' && !a.internal)?.address || '127.0.0.1';

// self-signed certificate, kept out of git (see .gitignore); regenerated when the LAN IP changes
const certDir = path.join(__dirname, '.cert');
const keyPath = path.join(certDir, 'key.pem'), certPath = path.join(certDir, 'cert.pem'), ipPath = path.join(certDir, 'ip.txt');
fs.mkdirSync(certDir, { recursive: true });
if (!(fs.existsSync(keyPath) && fs.existsSync(certPath) && fs.existsSync(ipPath) && fs.readFileSync(ipPath, 'utf8') === IP)) {
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-keyout', keyPath, '-out', certPath,
    '-days', '825', '-subj', '/CN=Bronchoscopy Simulator (local dev)', '-addext', `subjectAltName=IP:${IP},IP:127.0.0.1,DNS:localhost`],
    { stdio: 'ignore' });
  fs.writeFileSync(ipPath, IP);
}

const FILES = { '/': 'index.html', '/index.html': 'index.html', '/remote': 'remote.html', '/remote.html': 'remote.html' };
function handler(req, res) {
  const url = new URL(req.url, 'http://x');
  const send = (code, type, body) => { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(body); };
  if (FILES[url.pathname]) return send(200, 'text/html; charset=utf-8', fs.readFileSync(path.join(__dirname, FILES[url.pathname])));
  const s = url.searchParams.get('s') || '';
  if (url.pathname === '/api/info' && /^[A-Z0-9]{4,8}$/.test(s))
    return send(200, 'application/json', JSON.stringify({ phoneUrl: `https://${IP}:${HTTPS_PORT}/remote.html?s=${s}` }));
  send(404, 'text/plain', 'Not found');
}

http.createServer(handler).listen(HTTP_PORT, () => {
  https.createServer({ key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) }, handler).listen(HTTPS_PORT, () => {
    console.log('\n  Bronchoscopy Simulator (local dev)');
    console.log(`  ▶ Open on this computer:  http://localhost:${HTTP_PORT}`);
    console.log(`  📱 Phone page served at:   https://${IP}:${HTTPS_PORT}/remote.html  (same Wi-Fi; accept the self-signed certificate)\n`);
  });
});
