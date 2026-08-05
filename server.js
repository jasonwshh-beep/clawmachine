const express = require('express');
const http = require('http');
const crypto = require('crypto');
const WebSocket = require('ws');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'changeme';
const RELAY_KEY = process.env.RELAY_KEY || ADMIN_KEY;
const KICK_CHANNEL = (process.env.KICK_CHANNEL || 'w').toLowerCase();
const KICK_CHATROOM_ID = process.env.KICK_CHATROOM_ID || '';
const PUSHER_URL = 'wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=7.6.0&flash=false';

app.use(express.json({ limit: '128kb' }));
app.use(express.static('public'));

const state = {
  keyword: '!codew', prize: '$200', entriesOpen: false, drawing: false,
  entrants: [], winner: null, history: [], revision: 1,
  kick: { channel: KICK_CHANNEL, status: 'connecting', chatroomId: null, lastMessageAt: null, error: null }
};
const colors = ['#8b5cf6','#a855f7','#d946ef','#6366f1','#ec4899','#7c3aed','#c084fc','#9333ea'];
const species = ['bear','bunny','cat','frog','panda','fox'];
const avatarCache = new Map();

function normalizeAvatar(value) {
  if (!value) return '';
  if (typeof value === 'object') value = value.url || value.src || value.path || '';
  let url = String(value || '').trim();
  if (!url) return '';
  if (url.startsWith('//')) url = `https:${url}`;
  if (url.startsWith('/')) url = `https://kick.com${url}`;
  return /^https?:\/\//i.test(url) ? url : '';
}
async function resolveUserAvatar(username) {
  const key = cleanName(username).toLowerCase();
  if (!key) return '';
  if (avatarCache.has(key)) return avatarCache.get(key);
  try {
    const response = await fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(key)}`, {
      headers: {
        'accept':'application/json',
        'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
        'referer':`https://kick.com/${key}`
      }
    });
    if (!response.ok) throw new Error(`avatar lookup ${response.status}`);
    const data = await response.json();
    const user = data?.user || data?.channel?.user || data || {};
    const avatar = normalizeAvatar(
      user.profile_pic || user.profile_picture || user.avatar || user.avatar_url ||
      data?.profile_pic || data?.profile_picture || data?.avatar || data?.avatar_url
    );
    avatarCache.set(key, avatar);
    return avatar;
  } catch (err) {
    avatarCache.set(key, '');
    return '';
  }
}

function publicState() { return { ...state, entrantCount: state.entrants.length }; }
function broadcast() { state.revision++; io.emit('state', publicState()); }
function cleanName(v) { return String(v || '').trim().replace(/^@/, '').slice(0, 30); }
function seedFor(text) { return [...text].reduce((a,c)=>a+c.charCodeAt(0),0); }
function makeEntrant(username, avatarUrl) {
  const seed = seedFor(username);
  return {
    id: crypto.randomUUID(), username, avatarUrl: normalizeAvatar(avatarUrl),
    color: colors[seed % colors.length], species: species[seed % species.length],
    initial: username.slice(0,1).toUpperCase(), joinedAt: Date.now()
  };
}
function addEntrant(username, avatarUrl='') {
  username = cleanName(username);
  if (!state.entriesOpen || !username) return {ok:false, reason:'Entries are closed.'};
  if (state.entrants.some(e => e.username.toLowerCase() === username.toLowerCase())) return {ok:false, reason:'Already entered.'};
  const entrant = makeEntrant(username, avatarUrl);
  state.entrants.push(entrant); broadcast(); io.emit('entry:new', entrant);
  if (!entrant.avatarUrl) {
    resolveUserAvatar(username).then(url => {
      if (!url) return;
      const current = state.entrants.find(e => e.id === entrant.id);
      if (!current || current.avatarUrl) return;
      current.avatarUrl = url;
      broadcast();
    });
  }
  return {ok:true, entrant};
}
function processChatMessage(username, message, avatarUrl='') {
  state.kick.lastMessageAt = Date.now();
  io.emit('chat:new', { username, message, avatarUrl, at: Date.now() });
  if (String(message || '').trim().toLowerCase() === state.keyword.toLowerCase()) addEntrant(username, avatarUrl);
}
function admin(req,res,next) {
  const key = req.headers['x-admin-key'] || req.body?.adminKey;
  if (key !== ADMIN_KEY) return res.status(401).json({error:'Invalid admin key'});
  next();
}

app.get('/api/state', (_,res)=>res.json(publicState()));
app.post('/api/chat', (req,res) => {
  const key = req.headers['x-relay-key'] || req.body?.relayKey;
  if (key !== RELAY_KEY) return res.status(401).json({error:'Invalid relay key'});
  const { username, message, avatarUrl } = req.body || {};
  processChatMessage(cleanName(username), String(message || ''), avatarUrl || '');
  res.json({ok:true});
});
app.post('/api/admin/config', admin, (req,res)=>{
  if (req.body.keyword) state.keyword = String(req.body.keyword).trim().slice(0,30);
  if (req.body.prize) state.prize = String(req.body.prize).trim().slice(0,30);
  broadcast(); res.json({ok:true});
});
app.post('/api/admin/open', admin, (_,res)=>{state.entriesOpen=true; state.winner=null; broadcast(); res.json({ok:true});});
app.post('/api/admin/close', admin, (_,res)=>{state.entriesOpen=false; broadcast(); res.json({ok:true});});
app.post('/api/admin/reset', admin, (_,res)=>{state.entriesOpen=false;state.drawing=false;state.entrants=[];state.winner=null;broadcast();io.emit('reset');res.json({ok:true});});
app.post('/api/admin/entry', admin, (req,res)=>res.json(addEntrant(req.body.username, req.body.avatarUrl)));
app.post('/api/admin/demo', admin, (req,res)=>{
  const names=['PurpleGuy','ClutchUp','xSilentZ','ItsDev','Streakz','Zappy','Sketch','LuckyAce','BigW','ReelKing','PlushBoss','ShuffleFan','CodeWKing','MaxWin'];
  const before = state.entriesOpen; state.entriesOpen=true;
  names.forEach(n=>addEntrant(n)); state.entriesOpen=before; broadcast(); res.json({ok:true});
});
app.post('/api/admin/draw', admin, (_,res)=>{
  if (state.drawing || !state.entrants.length) return res.status(400).json({error:'Cannot draw right now'});
  state.entriesOpen=false; state.drawing=true; state.winner=null; broadcast();
  const winner = state.entrants[crypto.randomInt(0,state.entrants.length)];
  io.emit('draw:start', {winnerId:winner.id, duration:7600});
  setTimeout(()=>{
    state.winner=winner; state.history.unshift({...winner,wonAt:Date.now()}); state.history=state.history.slice(0,20);
    state.drawing=false; broadcast(); io.emit('draw:winner',winner);
  },7600);
  res.json({ok:true});
});

io.on('connection', socket => socket.emit('state', publicState()));

async function resolveChatroomId() {
  if (KICK_CHATROOM_ID) return String(KICK_CHATROOM_ID);
  const response = await fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(KICK_CHANNEL)}`, {
    headers: {
      'accept':'application/json',
      'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
      'referer':`https://kick.com/${KICK_CHANNEL}`
    }
  });
  if (!response.ok) throw new Error(`Kick channel lookup returned ${response.status}`);
  const data = await response.json();
  const id = data?.chatroom?.id;
  if (!id) throw new Error('Kick chatroom ID was not present in channel response');
  return String(id);
}

let kickSocket = null;
let reconnectTimer = null;
async function connectKickChat() {
  clearTimeout(reconnectTimer);
  try {
    state.kick.status='connecting'; state.kick.error=null; broadcast();
    const chatroomId = await resolveChatroomId();
    state.kick.chatroomId=chatroomId;
    const ws = new WebSocket(PUSHER_URL, { headers: { Origin: 'https://kick.com' } });
    kickSocket = ws;
    ws.on('open', ()=>{
      ws.send(JSON.stringify({ event:'pusher:subscribe', data:{ auth:'', channel:`chatrooms.${chatroomId}.v2` } }));
    });
    ws.on('message', raw=>{
      try {
        const packet=JSON.parse(raw.toString());
        if(packet.event==='pusher_internal:subscription_succeeded') {
          state.kick.status='connected'; state.kick.error=null; broadcast();
          return;
        }
        if(packet.event==='pusher:ping') { ws.send(JSON.stringify({event:'pusher:pong',data:{}})); return; }
        if(packet.event!=='App\\Events\\ChatMessageEvent') return;
        const data=typeof packet.data==='string'?JSON.parse(packet.data):packet.data;
        const sender=data?.sender || data?.user || {};
        const avatarUrl=normalizeAvatar(
          sender?.profile_pic || sender?.profile_picture || sender?.avatar || sender?.avatar_url ||
          sender?.identity?.profile_pic || sender?.identity?.profile_picture ||
          data?.profile_pic || data?.profile_picture || data?.avatar
        );
        processChatMessage(cleanName(sender.username || sender.slug || data?.username), String(data?.content || ''), avatarUrl);
      } catch(err) { console.error('Kick message parse error:',err.message); }
    });
    ws.on('close', ()=>{
      if(kickSocket!==ws) return;
      state.kick.status='reconnecting'; state.kick.error='Kick chat disconnected'; broadcast();
      reconnectTimer=setTimeout(connectKickChat,5000);
    });
    ws.on('error', err=>{
      state.kick.status='error'; state.kick.error=err.message; broadcast();
    });
  } catch(err) {
    state.kick.status='error'; state.kick.error=err.message; broadcast();
    console.error('Kick chat connection failed:',err.message);
    reconnectTimer=setTimeout(connectKickChat,15000);
  }
}

server.listen(PORT, '0.0.0.0', ()=>{
  console.log(`Code W Claw Machine running on ${PORT}`);
  console.log(`Connecting to Kick channel: kick.com/${KICK_CHANNEL}`);
  connectKickChat();
});
