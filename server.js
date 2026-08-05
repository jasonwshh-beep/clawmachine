const express = require('express');
const http = require('http');
const crypto = require('crypto');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'changeme';
const RELAY_KEY = process.env.RELAY_KEY || ADMIN_KEY;

app.use(express.json({ limit: '128kb' }));
app.use(express.static('public'));

const state = {
  keyword: '!codew', prize: '$200', entriesOpen: false, drawing: false,
  entrants: [], winner: null, history: [], revision: 1
};
const colors = ['#8b5cf6','#a855f7','#d946ef','#6366f1','#ec4899','#7c3aed','#c084fc'];
const animals = ['🐻','🐼','🐸','🦊','🐯','🐨','🐰','🦄','🐵','🐶','🐱','🐙'];

function publicState() { return {...state, entrantCount: state.entrants.length}; }
function broadcast() { state.revision++; io.emit('state', publicState()); }
function cleanName(v) { return String(v || '').trim().replace(/^@/, '').slice(0, 30); }
function makeEntrant(username, avatarUrl) {
  const seed = [...username].reduce((a,c)=>a+c.charCodeAt(0),0);
  return { id: crypto.randomUUID(), username, avatarUrl: avatarUrl || '', color: colors[seed % colors.length], animal: animals[seed % animals.length], joinedAt: Date.now() };
}
function addEntrant(username, avatarUrl='') {
  username = cleanName(username);
  if (!state.entriesOpen || !username) return {ok:false, reason:'Entries are closed.'};
  if (state.entrants.some(e => e.username.toLowerCase() === username.toLowerCase())) return {ok:false, reason:'Already entered.'};
  const entrant = makeEntrant(username, avatarUrl);
  state.entrants.push(entrant); broadcast(); io.emit('entry:new', entrant);
  return {ok:true, entrant};
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
  if (String(message || '').trim().toLowerCase() !== state.keyword.toLowerCase()) return res.json({ok:false, reason:'Keyword did not match'});
  res.json(addEntrant(username, avatarUrl));
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
  const names=['PurpleGuy','ClutchUp','xSilentZ','ItsDev','Streakz','Zappy','Sketch','LuckyAce','BigW','ReelKing','PlushBoss','ShuffleFan'];
  const before = state.entriesOpen; state.entriesOpen=true;
  names.forEach(n=>addEntrant(n)); state.entriesOpen=before; broadcast(); res.json({ok:true});
});
app.post('/api/admin/draw', admin, async (_,res)=>{
  if (state.drawing || !state.entrants.length) return res.status(400).json({error:'Cannot draw right now'});
  state.entriesOpen=false; state.drawing=true; state.winner=null; broadcast();
  const winner = state.entrants[crypto.randomInt(0,state.entrants.length)];
  io.emit('draw:start', {winnerId:winner.id, duration:6500});
  setTimeout(()=>{state.winner=winner;state.history.unshift({...winner,wonAt:Date.now()});state.history=state.history.slice(0,20);state.drawing=false;broadcast();io.emit('draw:winner',winner);},6500);
  res.json({ok:true});
});

io.on('connection', socket => socket.emit('state', publicState()));
server.listen(PORT, '0.0.0.0', ()=>console.log(`Code W Claw Machine running on ${PORT}`));
