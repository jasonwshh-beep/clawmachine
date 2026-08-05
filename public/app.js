const socket=io();
const $=s=>document.querySelector(s);
let state={};
let key=sessionStorage.getItem('adminKey')||'';
const chat=[];
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function avatar(e,cls=''){return e.avatarUrl?`<div class="${cls}"><img src="${esc(e.avatarUrl)}" alt=""></div>`:`<div class="${cls}" style="background:${e.color||'#7c3aed'}">${esc(e.initial||e.username?.[0]||'W')}</div>`}
function plush(e,extra=''){return `<div class="plush ${extra}" id="p-${e.id}" style="--plush:${e.color}"><div class="plush-ear left"></div><div class="plush-ear right"></div><div class="plush-body"></div><div class="plush-face">${e.avatarUrl?`<img src="${esc(e.avatarUrl)}" alt="${esc(e.username)}">`:esc(e.initial||'W')}</div><div class="plush-w">W</div><div class="plush-name">${esc(e.username)}</div></div>`}
function render(s){
  state=s;
  $('#count').textContent=s.entrants.length;
  $('#metricEntries').textContent=s.entrants.length;
  $('#metricUnique').textContent=s.entrants.length;
  $('#entryBadge').textContent=s.entrants.length;
  $('#status').textContent=s.drawing?'Drawing':s.entriesOpen?'Open':'Closed';
  $('#keyword').value=s.keyword;
  $('#prize').value=s.prize;
  $('#footerKeyword').textContent=s.keyword;
  $('#deckMessage').textContent=s.drawing?'CLAW IN MOTION':s.entriesOpen?`TYPE ${s.keyword.toUpperCase()} TO ENTER`:'GOOD LUCK!';
  $('#kickStatus').textContent=s.kick?.status==='connected'?`Connected to kick.com/${s.kick.channel}`:`Kick: ${s.kick?.status||'connecting'}`;
  $('#kickStatus').title=s.kick?.error||'';
  $('#plushies').innerHTML=s.entrants.map(plush).join('');
  $('#latestEntry').textContent=s.entrants.at(-1)?.username||'—';
  $('#entryList').innerHTML=s.entrants.slice().reverse().map(e=>`<div class="entry">${avatar(e,'entry-avatar')}<div><b>${esc(e.username)}</b><small>Entered the claw machine</small></div></div>`).join('')||'<div class="empty">No entries yet.</div>';
  if(s.winner) showWinner(s.winner);
}
function renderChat(){const target=$('#chatList');if(!target)return;target.innerHTML=chat.length?chat.map(m=>`<div class="chat-line">${avatar(m,'chat-avatar')}<div><b>${esc(m.username)}</b><p>${esc(m.message)}</p></div></div>`).join(''):'<div class="empty">Waiting for kick.com/w chat…</div>'}
function showWinner(e){const card=$('#winnerCard');card.innerHTML=`${plush(e,'winner-plush')}<small>${esc(state.prize)} WINNER</small><h3>${esc(e.username)}</h3><p>CODE W • SHUFFLE</p>`;card.classList.add('show')}
async function api(path,body={}){if(!key){key=prompt('Enter ADMIN_KEY');sessionStorage.setItem('adminKey',key||'')}const r=await fetch(path,{method:'POST',headers:{'content-type':'application/json','x-admin-key':key},body:JSON.stringify(body)});const j=await r.json();if(!r.ok){alert(j.error||'Request failed');if(r.status===401){key='';sessionStorage.removeItem('adminKey')}}return j}
$('#save').addEventListener('click',()=>api('/api/admin/config',{keyword:$('#keyword').value,prize:$('#prize').value}));
$('#open').addEventListener('click',()=>api('/api/admin/open'));
$('#close').addEventListener('click',()=>api('/api/admin/close'));
$('#reset').addEventListener('click',()=>confirm('Clear all entries?')&&api('/api/admin/reset'));
$('#demo').addEventListener('click',()=>api('/api/admin/demo'));
$('#draw').addEventListener('click',()=>api('/api/admin/draw'));
$('#drawDeck').addEventListener('click',()=>api('/api/admin/draw'));
$('#add').addEventListener('click',()=>{const n=$('#manual').value.trim();if(n)api('/api/admin/entry',{username:n});$('#manual').value=''});
socket.on('state',render);
socket.on('chat:new',m=>{m.initial=m.username?.[0]?.toUpperCase()||'W';m.color='#7c3aed';chat.unshift(m);chat.splice(30);renderChat()});
socket.on('draw:start',({winnerId})=>{
  $('#winnerCard').classList.remove('show');$('#machine').classList.add('drawing');
  const idx=state.entrants.findIndex(e=>e.id===winnerId);const cols=Math.max(1,Math.floor($('#plushies').clientWidth/80));const x=((idx%cols)+.5)/cols*82+9;$('#claw').style.left=x+'%';
  setTimeout(()=>{const p=$('#p-'+winnerId);if(p){p.style.transform='translateY(-270px) scale(1.12)';p.style.zIndex='12'}},5000);
});
socket.on('draw:winner',e=>{$('#machine').classList.remove('drawing');showWinner(e)});
socket.on('reset',()=>$('#winnerCard').classList.remove('show'));
