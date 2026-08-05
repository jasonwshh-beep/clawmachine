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
  document.querySelectorAll('.captured-ball').forEach(el=>{el.classList.remove('captured-ball','is-picked');el.style.removeProperty('animation');el.style.removeProperty('transition');el.style.removeProperty('transform');el.style.removeProperty('z-index')});document.querySelectorAll('.ball-pit.has-captured-ball').forEach(el=>el.classList.remove('has-captured-ball'));document.querySelectorAll('.pickup-ball,.pickup-ball-fixed').forEach(el=>el.remove());
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
      const raw=Math.min(1,(now-start)/duration);
      step(__ease(raw),raw);
      if(raw<1)requestAnimationFrame(frame);else resolve();
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
function __gripViewportPosition(claw,width,height){
  const gripper=claw.querySelector('.claw-gripper');
  const r=gripper.getBoundingClientRect();
  // Position the ball between the curved tips, not above the claw hub.
  const centerX=r.left+r.width/2;
  const centerY=r.bottom-height*.43;
  return {x:centerX-width/2,y:centerY-height/2};
}
function __viewportPointToLocal(parent,x,y){
  const r=parent.getBoundingClientRect();
  const scaleX=r.width/(parent.clientWidth||r.width)||1;
  const scaleY=r.height/(parent.clientHeight||r.height)||1;
  return {x:(x-r.left)/scaleX,y:(y-r.top)/scaleY};
}
function __prepareRealBall(target){
  const pit=target.closest('.ball-pit');
  if(!pit)return null;
  pit.classList.add('has-captured-ball');
  target.classList.add('captured-ball');
  target.style.animation='none';
  target.style.transition='none';
  target.style.transform='translate3d(0px,0px,0px) scale(1)';
  target.style.zIndex='100';
  // offsetLeft/offsetTop are in the same local coordinate system used by CSS transforms.
  return {
    target,
    pit,
    base:{x:target.offsetLeft,y:target.offsetTop,width:target.offsetWidth,height:target.offsetHeight}
  };
}
function __moveRealBallToViewport(pickup,viewportX,viewportY,scale=.96){
  const local=__viewportPointToLocal(pickup.pit,viewportX,viewportY);
  const dx=local.x-pickup.base.x;
  const dy=local.y-pickup.base.y;
  pickup.target.style.transform=`translate3d(${dx}px,${dy}px,0) scale(${scale})`;
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
  if(!glass||!target||!claw||!cable)return;

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

  await __tween(1150,p=>{claw.style.left=`${startX+(endX-startX)*p}px`});
  claw.style.left=`${endX}px`;
  await new Promise(requestAnimationFrame);

  const gripAtRest=__gripViewportPosition(claw,targetLocal.width,targetLocal.height);
  const targetRect=target.getBoundingClientRect();
  const targetCenterY=targetRect.top+targetRect.height/2;
  const gripCenterY=gripAtRest.y+targetRect.height/2;
  const glassRect=glass.getBoundingClientRect();
  const scaleY=glassRect.height/(glass.clientHeight||glassRect.height)||1;
  const extension=Math.max(0,(targetCenterY-gripCenterY)/scaleY);
  const desiredCable=Math.max(baseCable,Math.min(baseCable+extension,glass.clientHeight-150));

  claw.classList.add('is-dropping','is-open');
  await __tween(1450,p=>{
    const value=baseCable+(desiredCable-baseCable)*p;
    cable.style.height=`${value}px`;
    claw.style.setProperty('--cable-length',`${value}px`);
  });
  cable.style.height=`${desiredCable}px`;
  claw.style.setProperty('--cable-length',`${desiredCable}px`);
  await new Promise(requestAnimationFrame);

  claw.classList.remove('is-open');
  claw.classList.add('is-closed');
  await __sleep(380);

  const pickup=__prepareRealBall(target);
  const startRect=target.getBoundingClientRect();
  const start={x:startRect.left,y:startRect.top};
  let grip=__gripViewportPosition(claw,pickup.base.width,pickup.base.height);
  await __tween(420,p=>{
    const x=start.x+(grip.x-start.x)*p;
    const y=start.y+(grip.y-start.y)*p;
    __moveRealBallToViewport(pickup,x,y,1-.04*p);
  });
  grip=__gripViewportPosition(claw,pickup.base.width,pickup.base.height);
  __moveRealBallToViewport(pickup,grip.x,grip.y,.96);

  claw.classList.remove('is-dropping');
  claw.classList.add('is-lifting');
  await __tween(1850,p=>{
    const value=desiredCable+(baseCable-desiredCable)*p;
    cable.style.height=`${value}px`;
    claw.style.setProperty('--cable-length',`${value}px`);
    const current=__gripViewportPosition(claw,pickup.base.width,pickup.base.height);
    __moveRealBallToViewport(pickup,current.x,current.y,.96);
  });
  cable.style.height=`${baseCable}px`;
  claw.style.setProperty('--cable-length',`${baseCable}px`);

  const centerX=glass.clientWidth/2;
  await __tween(1250,p=>{
    claw.style.left=`${endX+(centerX-endX)*p}px`;
    const current=__gripViewportPosition(claw,pickup.base.width,pickup.base.height);
    __moveRealBallToViewport(pickup,current.x,current.y,.96);
  });
  claw.style.left='50%';
  await new Promise(requestAnimationFrame);
  const finalGrip=__gripViewportPosition(claw,pickup.base.width,pickup.base.height);
  __moveRealBallToViewport(pickup,finalGrip.x,finalGrip.y,.96);
}

function animate(winnerId){__animateClawToWinner(winnerId)}

window.addEventListener('resize',()=>layout(state.entrants?.length||0));socket.on('state',render);socket.on('draw:start',({winnerId})=>animate(winnerId));socket.on('draw:winner',showWinner);socket.on('reset',()=>{$('#winnerCard').classList.remove('show');clearAnim()});
