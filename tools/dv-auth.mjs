// Device-code login for Dataverse; caches the refresh token in tools/.cache (git-ignored).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const cacheFile = path.join(dir, '.cache', 'token.json');
const CLIENT_ID = '51f81489-12ee-4a9e-aaae-a2591f45987d';
const TENANT = 'organizations';
const ORG = process.env.DV_URL || 'https://orgf8f672a6.crm.dynamics.com';
const base = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0`;

async function post(url, body) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  return r.json();
}

export async function getToken() {
  const scope = `${ORG}/.default offline_access`;
  if (fs.existsSync(cacheFile)) {
    const c = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    if (c.access_token && c.expires_at > Date.now() + 120000) return c.access_token;
    if (c.refresh_token) {
      const t = await post(`${base}/token`, {
        client_id: CLIENT_ID, grant_type: 'refresh_token', refresh_token: c.refresh_token, scope,
      });
      if (t.access_token) return save(t);
    }
  }
  const dc = await post(`${base}/devicecode`, { client_id: CLIENT_ID, scope });
  console.log(dc.message);
  for (;;) {
    await new Promise((r) => setTimeout(r, (dc.interval || 5) * 1000));
    const t = await post(`${base}/token`, {
      client_id: CLIENT_ID, grant_type: 'urn:ietf:params:oauth:grant-type:device_code', device_code: dc.device_code,
    });
    if (t.access_token) return save(t);
    if (t.error && t.error !== 'authorization_pending') throw new Error(JSON.stringify(t));
  }
}

function save(t) {
  fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
  fs.writeFileSync(cacheFile, JSON.stringify({
    access_token: t.access_token, refresh_token: t.refresh_token, expires_at: Date.now() + t.expires_in * 1000,
  }));
  return t.access_token;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const tok = await getToken();
  const r = await fetch(`${ORG}/api/data/v9.2/WhoAmI`, { headers: { Authorization: `Bearer ${tok}` } });
  console.log(r.status, await r.text());
}
