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
function __ease(t){return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2}
function __tween(duration,step){
  return new Promise(resolve=>{
    const start=performance.now();
    function frame(now){
      const p=Math.min(1,(now-start)/duration);
      step(__ease(p),p);
      if(p<1)requestAnimationFrame(frame);else resolve();
    }
    requestAnimationFrame(frame);
  });
}
function __localRect(el,parent){
  const er=el.getBoundingClientRect();
  const pr=parent.getBoundingClientRect();
  const sx=pr.width/(parent.clientWidth||pr.width)||1;
  const sy=pr.height/(parent.clientHeight||pr.height)||1;
  return {left:(er.left-pr.left)/sx,top:(er.top-pr.top)/sy,width:er.width/sx,height:er.height/sy};
}
function __placeAtGrip(ball,cargo,glass,scale=.96){
  const b=__localRect(ball,glass);
  const g=__localRect(cargo,glass);
  ball.style.left=`${g.left+g.width/2-b.width/2}px`;
  ball.style.top=`${g.top+g.height/2-b.height/2}px`;
  ball.style.transform=`scale(${scale})`;
}
function __makePickup(target,glass){
  const r=__localRect(target,glass);
  const clone=target.cloneNode(true);
  clone.removeAttribute('id');
  clone.classList.remove('is-picked');
  clone.classList.add('pickup-ball');
  Object.assign(clone.style,{
    position:'absolute',left:`${r.left}px`,top:`${r.top}px`,right:'auto',bottom:'auto',
    width:`${r.width}px`,height:`${r.height}px`,margin:'0',animation:'none',transition:'none',
    transform:'none',zIndex:'16',pointerEvents:'none'
  });
  glass.appendChild(clone);
  target.classList.add('is-picked');
  return clone;
}
async function __animateClawToWinner(winnerId){
  if(typeof clearAnim==='function')clearAnim();else clearAnimation();
  document.querySelector('#winnerCard')?.classList.remove('show');
  await new Promise(requestAnimationFrame);
  await new Promise(requestAnimationFrame);

  const glass=document.querySelector('#glassPanel');
  const target=document.querySelector(`#ball-${CSS.escape(String(winnerId))}`);
  const claw=document.querySelector('#claw');
  const cable=claw?.querySelector('.claw-cable');
  const cargo=document.querySelector('#clawCargo');
  if(!glass||!target||!claw||!cable||!cargo)return;

  claw.getAnimations().forEach(a=>a.cancel());
  cable.getAnimations().forEach(a=>a.cancel());
  const baseCable=68;
  cable.style.height=`${baseCable}px`;
  claw.style.setProperty('--cable-length',`${baseCable}px`);

  const targetLocal=__localRect(target,glass);
  const clawLocal=__localRect(claw,glass);
  const startX=clawLocal.left+clawLocal.width/2;
  const wantedX=targetLocal.left+targetLocal.width/2;
  const half=Math.max(30,clawLocal.width/2);
  const endX=Math.max(half,Math.min(glass.clientWidth-half,wantedX));
  claw.style.left=`${startX}px`;

  await __tween(1250,p=>{claw.style.left=`${startX+(endX-startX)*p}px`});
  claw.style.left=`${endX}px`;

  const restGrip=__localRect(cargo,glass);
  const restGripY=restGrip.top+restGrip.height/2;
  const targetY=targetLocal.top+targetLocal.height/2;
  const visualPerCablePx=(claw.getBoundingClientRect().height/(claw.offsetHeight||claw.getBoundingClientRect().height))||1;
  const desiredCable=Math.max(baseCable,Math.min(baseCable+(targetY-restGripY)/visualPerCablePx,glass.clientHeight-150));

  claw.classList.add('is-dropping','is-open');
  await __tween(1450,p=>{
    const value=baseCable+(desiredCable-baseCable)*p;
    cable.style.height=`${value}px`;
    claw.style.setProperty('--cable-length',`${value}px`);
  });
  cable.style.height=`${desiredCable}px`;
  claw.style.setProperty('--cable-length',`${desiredCable}px`);

  claw.classList.remove('is-open');
  claw.classList.add('is-closed');
  await __sleep(380);

  const pickup=__makePickup(target,glass);
  const pickupStart=__localRect(pickup,glass);
  const gripNow=__localRect(cargo,glass);
  const gripLeft=gripNow.left+gripNow.width/2-pickupStart.width/2;
  const gripTop=gripNow.top+gripNow.height/2-pickupStart.height/2;
  await __tween(420,p=>{
    pickup.style.left=`${pickupStart.left+(gripLeft-pickupStart.left)*p}px`;
    pickup.style.top=`${pickupStart.top+(gripTop-pickupStart.top)*p}px`;
    pickup.style.transform=`scale(${1-.04*p})`;
  });
  __placeAtGrip(pickup,cargo,glass,.96);

  claw.classList.remove('is-dropping');
  claw.classList.add('is-lifting');
  await __tween(1800,p=>{
    const value=desiredCable+(baseCable-desiredCable)*p;
    cable.style.height=`${value}px`;
    claw.style.setProperty('--cable-length',`${value}px`);
    __placeAtGrip(pickup,cargo,glass,.96);
  });
  cable.style.height=`${baseCable}px`;
  claw.style.setProperty('--cable-length',`${baseCable}px`);
  __placeAtGrip(pickup,cargo,glass,.96);

  const centerX=glass.clientWidth/2;
  await __tween(1200,p=>{
    claw.style.left=`${endX+(centerX-endX)*p}px`;
    __placeAtGrip(pickup,cargo,glass,.96);
  });
  claw.style.left='50%';
  __placeAtGrip(pickup,cargo,glass,.96);
}

function animate(winnerId){__animateClawToWinner(winnerId)}

window.addEventListener('resize',()=>layout(state.entrants?.length||0));socket.on('state',render);socket.on('draw:start',({winnerId})=>animate(winnerId));socket.on('draw:winner',showWinner);socket.on('reset',()=>{$('#winnerCard').classList.remove('show');clearAnim()});
