// Always-on WhatsApp Web worker (Railway / Render / VPS). NOT for Vercel: serverless can't hold a session.
import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import QRCode from 'qrcode'; import express from 'express'; import cors from 'cors'; import fs from 'fs';
const { TOKEN = 'change-me', DASHBOARD_URL, PORT = 3000, DAILY_CAP = '25', MIN_DELAY = '45', MAX_DELAY = '120', START_HOUR = '10', END_HOUR = '19' } = process.env;
fs.mkdirSync('data', { recursive: true });
const DB = 'data/log.json';
const db = fs.existsSync(DB) ? JSON.parse(fs.readFileSync(DB)) : { sent: [], blocked: [], replies: [], auto: false };
const save = () => fs.writeFileSync(DB, JSON.stringify(db));
let sock, qr = '', state = 'disconnected';
const sentToday = () => db.sent.filter(s => !s.err && Date.now() - s.at < 864e5).length;

async function connect() {
  const { state: auth, saveCreds } = await useMultiFileAuthState('data/auth');
  const { version } = await fetchLatestBaileysVersion();
  sock = makeWASocket({ auth, version });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', async u => {
    if (u.qr) { qr = await QRCode.toDataURL(u.qr); state = 'qr'; }
    if (u.connection === 'open') { qr = ''; state = 'connected'; }
    if (u.connection === 'close') {
      state = 'disconnected';
      if (u.lastDisconnect?.error?.output?.statusCode === DisconnectReason.loggedOut) fs.rmSync('data/auth', { recursive: true, force: true });
      connect();
    }
  });
  sock.ev.on('messages.upsert', ({ messages }) => {
    for (const m of messages) {
      if (m.key.fromMe || m.key.remoteJid.endsWith('@g.us')) continue;
      const p = m.key.remoteJid.split('@')[0];
      const t = (m.message?.conversation || m.message?.extendedTextMessage?.text || '').toLowerCase();
      if (/\b(stop|unsubscribe|nahi chahiye|band karo)\b/.test(t) && !db.blocked.includes(p)) db.blocked.push(p);
      db.replies.push({ p, t: t.slice(0, 200), at: Date.now() }); save();
    }
  });
}
async function send(l) {
  if (state !== 'connected') throw new Error('WhatsApp connected nahi hai');
  if (db.blocked.includes(l.phone)) throw new Error('Lead ne opt-out kiya hai');
  const [r] = await sock.onWhatsApp(l.phone);
  if (!r?.exists) throw new Error('Number WhatsApp pe nahi hai');
  await sock.sendMessage(r.jid, { text: l.pitch });
  db.sent.push({ id: l.id, phone: l.phone, at: Date.now() }); save();
}
async function tick() {
  if (!db.auto || state !== 'connected' || !DASHBOARD_URL) return;
  const h = +new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false }) % 24;
  if (h < +START_HOUR || h >= +END_HOUR || sentToday() >= +DAILY_CAP) return;
  const { leads } = await (await fetch(DASHBOARD_URL + '/api/leads')).json();
  const l = leads.filter(x => x.hot && x.mobile && x.pitch && !db.sent.some(s => s.id === x.id) && !db.blocked.includes(x.phone))
    .sort((a, b) => b.score - a.score)[0];
  if (l) try { await send(l); } catch (e) { db.sent.push({ id: l.id, phone: l.phone, at: Date.now(), err: e.message }); save(); }
}
(function loop() { tick().catch(() => {}); setTimeout(loop, (+MIN_DELAY + Math.random() * (+MAX_DELAY - +MIN_DELAY)) * 1000); })();

const app = express(); app.use(cors(), express.json());
app.use((q, s, n) => q.headers.authorization === 'Bearer ' + TOKEN ? n() : s.status(401).json({ error: 'Token galat hai' }));
app.get('/status', (q, s) => s.json({ state, qr, auto: db.auto, sentToday: sentToday(), cap: +DAILY_CAP, sent: db.sent, blocked: db.blocked, replies: db.replies.slice(-30) }));
app.post('/send', async (q, s) => { try { await send(q.body); s.json({ ok: true }); } catch (e) { s.status(400).json({ error: e.message }); } });
app.post('/auto', (q, s) => { db.auto = !!q.body.on; save(); s.json({ auto: db.auto }); });
app.post('/logout', async (q, s) => { try { await sock.logout(); } catch {} s.json({ ok: true }); });
app.listen(PORT); connect();
