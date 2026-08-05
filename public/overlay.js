const socket=io();const $=s=>document.querySelector(s);let state={};let timers=[];
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function fallbackAvatar(color='#7c3aed'){return `<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="32" fill="${esc(color)}"/><circle cx="32" cy="24" r="12" fill="#eee9f4"/><path d="M13 57c2-13 10-20 19-20s17 7 19 20" fill="#eee9f4"/></svg>`}
function avatar(e){return e.avatarUrl?`<img src="${esc(e.avatarUrl)}" alt="${esc(e.username)} profile picture" referrerpolicy="no-referrer" crossorigin="anonymous" onerror="this.parentElement.innerHTML='${fallbackAvatar(e.color).replace(/'/g,"&#39;")}'">`:fallbackAvatar(e.color)}
function ball(e){return `<div class="entry-ball" id="ball-${e.id}" style="--ball-color:${esc(e.color||'#7c3aed')};--ball-index:${Math.abs(String(e.id).split('').reduce((a,c)=>a+c.charCodeAt(0),0))%20}"><div class="ball-avatar">${avatar(e)}</div></div>`}
function layout(count){
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

function render(s){state=s;$('#ballPit').innerHTML=s.entrants.map(ball).join('');$('#deckMessage').textContent=s.keyword.toUpperCase();requestAnimationFrame(()=>layout(s.entrants.length));if(s.winner)showWinner(s.winner)}
function showWinner(e){const c=$('#winnerCard');c.innerHTML=`<div class="winner-avatar">${avatar(e)}</div><small>${esc(state.prize)} WINNER</small><h3>${esc(e.username)}</h3><p>Selected from ${state.entrants.length} entries</p>`;c.classList.add('show')}
function clearAnim(){
  timers.forEach(clearTimeout);timers=[];
  const claw=$('#claw');
  claw.classList.remove('is-closed','is-dropping','is-lifting');claw.classList.add('is-open');
  claw.getAnimations().forEach(a=>a.cancel());claw.style.left='50%';claw.style.setProperty('--cable-length','68px');
  $('#clawCargo').innerHTML='';
  document.querySelectorAll('.pickup-ball').forEach(el=>el.remove());
}
function later(fn,delay){const id=setTimeout(fn,delay);timers.push(id)}
async function createPickupBall(target,glass){
  const targetRect=target.getBoundingClientRect();
  const glassRect=glass.getBoundingClientRect();
  const clone=target.cloneNode(true);
  clone.removeAttribute('id');
  clone.classList.remove('is-picked');
  clone.classList.add('pickup-ball');
  Object.assign(clone.style,{
    position:'absolute',
    left:`${targetRect.left-glassRect.left}px`,
    top:`${targetRect.top-glassRect.top}px`,
    right:'auto',bottom:'auto',
    width:`${targetRect.width}px`,height:`${targetRect.height}px`,
    margin:'0',animation:'none',transition:'none',
    transform:'none',zIndex:'16'
  });
  glass.appendChild(clone);
  target.classList.add('is-picked');
  return clone;
}
function __sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
async function __animateClawToWinner(winnerId){
  clearAnim();
  $('#winnerCard')?.classList.remove('show');
  await new Promise(requestAnimationFrame);
  await new Promise(requestAnimationFrame);

  const glass=$('#glassPanel');
  const target=document.querySelector(`#ball-${CSS.escape(String(winnerId))}`);
  const claw=$('#claw');
  const cable=$('#claw .claw-cable');
  const cargo=$('#clawCargo');
  if(!glass||!target||!claw||!cable||!cargo)return;

  const glassRect=glass.getBoundingClientRect();
  const targetRect=target.getBoundingClientRect();
  const clawRect=claw.getBoundingClientRect();
  const targetX=targetRect.left+targetRect.width/2-glassRect.left;
  const minX=clawRect.width*.55;
  const maxX=glassRect.width-clawRect.width*.55;
  const finalX=Math.max(minX,Math.min(maxX,targetX));
  const startX=clawRect.left+clawRect.width/2-glassRect.left;

  claw.style.left=`${startX}px`;
  await claw.animate(
    [{left:`${startX}px`},{left:`${finalX}px`}],
    {duration:1400,easing:'cubic-bezier(.22,.72,.18,1)',fill:'forwards'}
  ).finished.catch(()=>{});
  claw.style.left=`${finalX}px`;

  const freshTarget=target.getBoundingClientRect();
  const freshGlass=glass.getBoundingClientRect();
  const targetCenterY=freshTarget.top+freshTarget.height/2-freshGlass.top;
  const currentCable=parseFloat(getComputedStyle(cable).height)||68;
  const gripOffset=112;
  const desiredCable=Math.max(68,Math.min(freshGlass.height-170,targetCenterY-gripOffset));

  claw.classList.add('is-dropping','is-open');
  await cable.animate(
    [{height:`${currentCable}px`},{height:`${desiredCable}px`}],
    {duration:1500,easing:'cubic-bezier(.42,0,.2,1)',fill:'forwards'}
  ).finished.catch(()=>{});
  claw.style.setProperty('--cable-length',`${desiredCable}px`);
  cable.style.height=`${desiredCable}px`;

  claw.classList.remove('is-open');
  claw.classList.add('is-closed');
  await __sleep(420);

  const pickup=await createPickupBall(target,glass);
  const pickupRect=pickup.getBoundingClientRect();
  const cargoRect=cargo.getBoundingClientRect();
  const pickupLeft=pickupRect.left-freshGlass.left;
  const pickupTop=pickupRect.top-freshGlass.top;
  const gripLeft=cargoRect.left+cargoRect.width/2-freshGlass.left-pickupRect.width/2;
  const gripTop=cargoRect.top+cargoRect.height/2-freshGlass.top-pickupRect.height/2;

  await pickup.animate(
    [
      {left:`${pickupLeft}px`,top:`${pickupTop}px`,transform:'scale(1)'},
      {left:`${gripLeft}px`,top:`${gripTop}px`,transform:'scale(.96)'}
    ],
    {duration:520,easing:'cubic-bezier(.18,.82,.2,1)',fill:'forwards'}
  ).finished.catch(()=>{});
  pickup.style.left=`${gripLeft}px`;
  pickup.style.top=`${gripTop}px`;
  pickup.style.transform='scale(.96)';

  await __sleep(120);
  claw.classList.remove('is-dropping');
  claw.classList.add('is-lifting');

  const liftDistance=desiredCable-68;
  const liftedTop=gripTop-liftDistance;
  await Promise.all([
    cable.animate(
      [{height:`${desiredCable}px`},{height:'68px'}],
      {duration:1800,easing:'cubic-bezier(.35,0,.2,1)',fill:'forwards'}
    ).finished.catch(()=>{}),
    pickup.animate(
      [{top:`${gripTop}px`},{top:`${liftedTop}px`}],
      {duration:1800,easing:'cubic-bezier(.35,0,.2,1)',fill:'forwards'}
    ).finished.catch(()=>{})
  ]);
  claw.style.setProperty('--cable-length','68px');
  cable.style.height='68px';
  pickup.style.top=`${liftedTop}px`;

  const centerX=freshGlass.width/2;
  const horizontalDelta=centerX-finalX;
  const centeredLeft=gripLeft+horizontalDelta;
  await Promise.all([
    claw.animate(
      [{left:`${finalX}px`},{left:`${centerX}px`}],
      {duration:1200,easing:'cubic-bezier(.22,.72,.18,1)',fill:'forwards'}
    ).finished.catch(()=>{}),
    pickup.animate(
      [{left:`${gripLeft}px`},{left:`${centeredLeft}px`}],
      {duration:1200,easing:'cubic-bezier(.22,.72,.18,1)',fill:'forwards'}
    ).finished.catch(()=>{})
  ]);
  claw.style.left='50%';
  pickup.style.left=`${centeredLeft}px`;
}
function animate(winnerId){__animateClawToWinner(winnerId)}

window.addEventListener('resize',()=>layout(state.entrants?.length||0));socket.on('state',render);socket.on('draw:start',({winnerId})=>animate(winnerId));socket.on('draw:winner',showWinner);socket.on('reset',()=>{$('#winnerCard').classList.remove('show');clearAnim()});
