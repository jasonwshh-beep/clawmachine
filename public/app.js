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
function avatarMarkup(e){return e.avatarUrl?`<img src="${esc(e.avatarUrl)}" alt="${esc(e.username)} profile picture" loading="eager" referrerpolicy="no-referrer" onerror="this.style.display='none';this.nextElementSibling.style.display='block'">${fallbackAvatar(e.color).replace('<svg ','<svg style="display:none" ')}`:fallbackAvatar(e.color)}
function listAvatar(e,cls){return `<div class="${cls}">${avatarMarkup(e)}</div>`}
function ball(e){return `<div class="entry-ball" id="ball-${e.id}" data-entry-id="${e.id}" title="${esc(e.username)}" style="--ball-color:${esc(e.color||'#7c3aed')};--ball-index:${Math.abs(String(e.id).split('').reduce((a,c)=>a+c.charCodeAt(0),0))%20}"><div class="ball-avatar">${avatarMarkup(e)}</div></div>`}

function updateBallLayout(count){
  const pit=$('#ballPit');
  if(!pit)return;
  const balls=[...pit.querySelectorAll('.entry-ball')];
  const rect=pit.getBoundingClientRect();
  const glass=$('#glassPanel')?.getBoundingClientRect();
  const width=Math.max(120,rect.width-18);
  const safeHeight=Math.max(70,Math.min(rect.height-8,(glass?.height||rect.height)*.50));
  if(!count||!balls.length)return;

  let size=84,cols=1;
  for(let candidate=84;candidate>=7;candidate-=1){
    const horizontal=candidate*.82;
    const vertical=candidate*.73;
    const possibleCols=Math.max(1,Math.floor((width-candidate*.12)/horizontal));
    const possibleRows=Math.max(1,Math.floor((safeHeight-candidate*.10)/vertical));
    if(possibleCols*possibleRows>=count){size=candidate;cols=possibleCols;break}
    size=candidate;cols=possibleCols;
  }

  const hStep=size*.82,vStep=size*.73;
  balls.forEach((el,index)=>{
    const row=Math.floor(index/cols);
    const col=index%cols;
    const inRow=Math.min(cols,count-row*cols);
    const seed=Math.abs(String(el.dataset.entryId||el.id||index).split('').reduce((a,c)=>((a*31)+c.charCodeAt(0))>>>0,7));
    const rowShift=(row%2)*size*.40;
    const rowWidth=(inRow-1)*hStep+size;
    const baseLeft=Math.max(1,(width-rowWidth)/2+rowShift-(row%2&&rowWidth+rowShift>width?size*.40:0));
    const jitterX=((seed%17)-8)*size*.010;
    const jitterY=(((seed>>4)%11)-5)*size*.010;
    const bottom=Math.min(safeHeight-size,Math.max(0,row*vStep+jitterY));
    el.style.width=`${size}px`;
    el.style.height=`${size}px`;
    el.style.left=`${Math.max(0,Math.min(width-size,baseLeft+col*hStep+jitterX))}px`;
    el.style.bottom=`${bottom}px`;
    el.style.setProperty('--rest-rotation',`${((seed%19)-9)*.7}deg`);
    el.style.zIndex=String(5+row);
  });
  pit.classList.toggle('compact',count>45);
  pit.classList.toggle('dense',count>120);
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
  claw.classList.remove('is-closed','is-dropping','is-lifting');claw.classList.add('is-open');
  claw.getAnimations().forEach(a=>a.cancel());claw.style.left='50%';claw.style.setProperty('--cable-length','68px');
  $('#clawCargo').innerHTML='';
  document.querySelectorAll('.pickup-ball').forEach(el=>el.remove());
}
function schedule(fn,delay){const id=setTimeout(fn,delay);animationTimers.push(id)}
function captureBall(target,glass){
  const cargo=$('#clawCargo');
  const targetRect=target.getBoundingClientRect();
  const glassRect=glass.getBoundingClientRect();
  const cargoRect=cargo.getBoundingClientRect();
  const clone=target.cloneNode(true);
  clone.removeAttribute('id');
  clone.classList.remove('is-picked');
  clone.classList.add('pickup-ball');
  Object.assign(clone.style,{
    left:`${targetRect.left-glassRect.left}px`,top:`${targetRect.top-glassRect.top}px`,
    width:`${targetRect.width}px`,height:`${targetRect.height}px`,transition:'none',transform:'none'
  });
  glass.appendChild(clone);
  target.classList.add('is-picked');
  const endLeft=cargoRect.left+cargoRect.width/2-glassRect.left-targetRect.width/2;
  const endTop=cargoRect.top+cargoRect.height/2-glassRect.top-targetRect.height/2;
  clone.animate([
    {left:`${targetRect.left-glassRect.left}px`,top:`${targetRect.top-glassRect.top}px`,transform:'scale(1)'},
    {left:`${endLeft}px`,top:`${endTop}px`,transform:'scale(.96)'}
  ],{duration:360,easing:'cubic-bezier(.2,.8,.2,1)',fill:'forwards'}).finished.then(()=>{
    cargo.style.setProperty('--captured-size',`${Math.min(60,targetRect.width)}px`);
    clone.classList.remove('pickup-ball');
    clone.removeAttribute('style');
    cargo.appendChild(clone);
  }).catch(()=>{});
}
function __sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
async function __animateClawToWinner(winnerId){
  clearAnimation();
  const winnerCard=document.querySelector('#winnerCard');
  if(winnerCard) winnerCard.classList.remove('show');
  await new Promise(requestAnimationFrame);
  await new Promise(requestAnimationFrame);

  const glass=document.querySelector('#glassPanel');
  const target=document.querySelector(`#ball-${CSS.escape(String(winnerId))}`);
  const claw=document.querySelector('#claw');
  if(!glass||!target||!claw)return;

  const glassRect=glass.getBoundingClientRect();
  const targetRect=target.getBoundingClientRect();
  const clawRect=claw.getBoundingClientRect();
  const targetX=targetRect.left+targetRect.width/2-glassRect.left;
  const minX=clawRect.width*.55;
  const maxX=glassRect.width-clawRect.width*.55;
  const finalX=Math.max(minX,Math.min(maxX,targetX));
  const startX=clawRect.left+clawRect.width/2-glassRect.left;

  claw.style.left=`${startX}px`;
  claw.getAnimations().forEach(a=>a.cancel());
  await claw.animate(
    {left:[`${startX}px`,`${finalX}px`]},
    {duration:1400,easing:'cubic-bezier(.22,.72,.18,1)',fill:'forwards'}
  ).finished.catch(()=>{});
  claw.style.left=`${finalX}px`;

  const refreshedTarget=target.getBoundingClientRect();
  const refreshedGlass=glass.getBoundingClientRect();
  const targetCenterY=refreshedTarget.top+refreshedTarget.height/2-refreshedGlass.top;
  const cable=document.querySelector('#claw .claw-cable');
  const currentCable=parseFloat(getComputedStyle(cable).height)||68;
  const hubAndGrip=118;
  const desiredCable=Math.max(68,Math.min(refreshedGlass.height-170,targetCenterY-hubAndGrip));

  claw.classList.add('is-dropping','is-open');
  await cable.animate(
    {height:[`${currentCable}px`,`${desiredCable}px`]},
    {duration:1500,easing:'cubic-bezier(.42,0,.2,1)',fill:'forwards'}
  ).finished.catch(()=>{});
  claw.style.setProperty('--cable-length',`${desiredCable}px`);
  cable.style.height=`${desiredCable}px`;

  claw.classList.remove('is-open');
  claw.classList.add('is-closed');
  await __sleep(480);

  captureBall(target,glass);
  await __sleep(520);

  claw.classList.remove('is-dropping');
  claw.classList.add('is-lifting');
  await cable.animate(
    {height:[`${desiredCable}px`,'68px']},
    {duration:1700,easing:'cubic-bezier(.35,0,.2,1)',fill:'forwards'}
  ).finished.catch(()=>{});
  claw.style.setProperty('--cable-length','68px');
  cable.style.height='68px';

  await claw.animate(
    {left:[`${finalX}px`,`${refreshedGlass.width/2}px`]},
    {duration:1200,easing:'cubic-bezier(.22,.72,.18,1)',fill:'forwards'}
  ).finished.catch(()=>{});
  claw.style.left='50%';
}
function animateDraw(winnerId){__animateClawToWinner(winnerId)}

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
async function addManual(){const input=$('#manual');const n=input.value.trim();if(!n)return;const result=await api('/api/admin/entry',{username:n});if(result?.ok){input.value='';input.focus();}}
$('#add').addEventListener('click',addManual);
$('#manual').addEventListener('keydown',e=>{if(e.key==='Enter')addManual()});
window.addEventListener('resize',()=>updateBallLayout(state.entrants?.length||0));
socket.on('state',render);
socket.on('chat:new',m=>{m.color='#7c3aed';chat.unshift(m);chat.splice(50);renderChat()});
socket.on('draw:start',({winnerId})=>animateDraw(winnerId));
socket.on('draw:winner',e=>{showWinner(e)});
socket.on('reset',()=>{$('#winnerCard').classList.remove('show');clearAnimation()});
