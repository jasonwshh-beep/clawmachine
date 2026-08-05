const socket=io();
const $=s=>document.querySelector(s);
let state={};
let key=sessionStorage.getItem('adminKey')||'';
let animationTimers=[];
const chat=[];

function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function fallbackAvatar(color='#7c3aed'){
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="32" fill="${esc(color)}"/><circle cx="32" cy="24" r="12" fill="#eee9f4"/><path d="M13 57c2-13 10-20 19-20s17 7 19 20" fill="#eee9f4"/></svg>`;
}
function avatarMarkup(e){return e.avatarUrl?`<img src="${esc(e.avatarUrl)}" alt="${esc(e.username)} profile picture" loading="eager" referrerpolicy="no-referrer">`:fallbackAvatar(e.color)}
function listAvatar(e,cls){return `<div class="${cls}">${avatarMarkup(e)}</div>`}
function ball(e){return `<div class="entry-ball" id="ball-${e.id}" data-entry-id="${e.id}" title="${esc(e.username)}" style="--ball-color:${esc(e.color||'#7c3aed')}"><div class="ball-avatar">${avatarMarkup(e)}</div></div>`}

function updateBallLayout(count){
  const pit=$('#ballPit');
  if(!pit)return;
  const rect=pit.getBoundingClientRect();
  const aspect=Math.max(1,rect.width/Math.max(1,rect.height));
  const cols=Math.max(1,Math.ceil(Math.sqrt(Math.max(1,count)*aspect)));
  const rows=Math.max(1,Math.ceil(Math.max(1,count)/cols));
  const maxSize=Math.max(16,Math.min((rect.width-20)/cols,(rect.height-20)/rows)*.91);
  pit.style.setProperty('--cols',cols);
  pit.style.setProperty('--rows',rows);
  pit.style.setProperty('--ball-size',`${Math.min(86,maxSize)}px`);
  pit.style.gridTemplateRows=`repeat(${rows},minmax(0,1fr))`;
  pit.classList.toggle('compact',count>45);
  pit.classList.toggle('dense',count>100);
}

function render(s){
  state=s;
  $('#count').textContent=s.entrants.length;
  $('#metricEntries').textContent=s.entrants.length;
  $('#metricUnique').textContent=s.entrants.length;
  $('#entryBadge').textContent=s.entrants.length;
  $('#status').textContent=s.drawing?'Drawing':s.entriesOpen?'Open':'Closed';
  $('#keyword').value=s.keyword;
  $('#prize').value=s.prize;
  $('#deckMessage').textContent=s.keyword.toUpperCase();
  const connected=s.kick?.status==='connected';
  $('#kickStatus').textContent=connected?'Kick connected':`Kick ${s.kick?.status||'connecting'}`;
  $('#kickStatus').title=s.kick?.error||'';
  $('#connectionPill').classList.toggle('offline',!connected);
  $('#ballPit').innerHTML=s.entrants.map(ball).join('');
  requestAnimationFrame(()=>updateBallLayout(s.entrants.length));
  $('#latestEntry').textContent=s.entrants.at(-1)?.username||'—';
  $('#entryList').innerHTML=s.entrants.slice().reverse().map(e=>`<div class="entry">${listAvatar(e,'entry-avatar')}<div><b>${esc(e.username)}</b><small>Entered with ${esc(s.keyword)}</small></div></div>`).join('')||'<div class="empty-state">No entries yet.</div>';
  if(s.winner)showWinner(s.winner);
}
function renderChat(){
  $('#chatList').innerHTML=chat.length?chat.map(m=>`<div class="chat-line">${listAvatar(m,'chat-avatar')}<div><b>${esc(m.username)}</b><p>${esc(m.message)}</p></div></div>`).join(''):'<div class="empty-state">Waiting for kick.com/w chat…</div>';
}
function showWinner(e){
  const card=$('#winnerCard');
  card.innerHTML=`<div class="winner-avatar">${avatarMarkup(e)}</div><small>${esc(state.prize)} WINNER</small><h3>${esc(e.username)}</h3><p>Selected from ${state.entrants.length} entries</p>`;
  card.classList.add('show');
}
function clearAnimation(){
  animationTimers.forEach(clearTimeout);animationTimers=[];
  const claw=$('#claw');
  claw.classList.remove('is-closed');claw.classList.add('is-open');
  claw.style.left='50%';claw.style.top='25px';
  $('#clawCargo').innerHTML='';
}
function schedule(fn,delay){const id=setTimeout(fn,delay);animationTimers.push(id)}
function animateDraw(winnerId){
  clearAnimation();
  $('#winnerCard').classList.remove('show');
  const glass=$('#glassPanel'),target=$(`#ball-${CSS.escape(winnerId)}`),claw=$('#claw');
  if(!glass||!target)return;
  const g=glass.getBoundingClientRect(),b=target.getBoundingClientRect();
  const targetX=((b.left+b.width/2-g.left)/g.width)*100;
  const targetTop=Math.max(120,Math.min(g.height-210,b.top-g.top-125));
  claw.style.left=`${targetX}%`;
  schedule(()=>{claw.style.top=`${targetTop}px`},1750);
  schedule(()=>{claw.classList.remove('is-open');claw.classList.add('is-closed')},3300);
  schedule(()=>{
    const current=$(`#ball-${CSS.escape(winnerId)}`);
    if(current){current.classList.add('is-picked');const clone=current.cloneNode(true);clone.removeAttribute('id');clone.classList.remove('is-picked');$('#clawCargo').appendChild(clone)}
  },3650);
  schedule(()=>{claw.style.top='25px'},4100);
  schedule(()=>{claw.style.left='50%'},5700);
}
async function api(path,body={}){
  if(!key){key=prompt('Enter ADMIN_KEY');sessionStorage.setItem('adminKey',key||'')}
  const r=await fetch(path,{method:'POST',headers:{'content-type':'application/json','x-admin-key':key},body:JSON.stringify(body)});
  const j=await r.json();
  if(!r.ok){alert(j.error||'Request failed');if(r.status===401){key='';sessionStorage.removeItem('adminKey')}}
  return j;
}
$('#save').addEventListener('click',()=>api('/api/admin/config',{keyword:$('#keyword').value,prize:$('#prize').value}));
$('#open').addEventListener('click',()=>api('/api/admin/open'));
$('#close').addEventListener('click',()=>api('/api/admin/close'));
$('#reset').addEventListener('click',()=>confirm('Clear all entries?')&&api('/api/admin/reset'));
$('#demo').addEventListener('click',()=>api('/api/admin/demo'));
$('#draw').addEventListener('click',()=>api('/api/admin/draw'));
$('#drawDeck').addEventListener('click',()=>api('/api/admin/draw'));
$('#add').addEventListener('click',()=>{const n=$('#manual').value.trim();if(n)api('/api/admin/entry',{username:n});$('#manual').value=''});
window.addEventListener('resize',()=>updateBallLayout(state.entrants?.length||0));
socket.on('state',render);
socket.on('chat:new',m=>{m.color='#7c3aed';chat.unshift(m);chat.splice(50);renderChat()});
socket.on('draw:start',({winnerId})=>animateDraw(winnerId));
socket.on('draw:winner',e=>{showWinner(e)});
socket.on('reset',()=>{$('#winnerCard').classList.remove('show');clearAnimation()});
