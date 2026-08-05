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
  document.querySelectorAll('.captured-ball').forEach(el=>{el.classList.remove('captured-ball','is-picked');el.style.removeProperty('animation');el.style.removeProperty('transition');el.style.removeProperty('transform');el.style.removeProperty('z-index')});document.querySelectorAll('.ball-pit.has-captured-ball').forEach(el=>el.classList.remove('has-captured-ball'));document.querySelectorAll('.pickup-ball,.pickup-ball-fixed,.captured-orb').forEach(el=>el.remove());
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
  const sx=(parent.clientWidth||pr.width)/pr.width;
  const sy=(parent.clientHeight||pr.height)/pr.height;
  return {left:(er.left-pr.left)*sx,top:(er.top-pr.top)*sy,width:er.width*sx,height:er.height*sy};
}
function __gripLocal(claw,glass,ballW,ballH){
  const gripper=claw.querySelector('.claw-gripper');
  const g=__localRect(gripper,glass);
  return {
    x:g.left+g.width/2-ballW/2,
    y:g.top+g.height-ballH*.72
  };
}
function __makeCapturedOrb(target,glass){
  const r=__localRect(target,glass);
  const orb=target.cloneNode(true);
  orb.removeAttribute('id');
  orb.className='entry-ball captured-orb';
  orb.style.setProperty('position','absolute','important');
  orb.style.setProperty('left',`${r.left}px`,'important');
  orb.style.setProperty('top',`${r.top}px`,'important');
  orb.style.setProperty('right','auto','important');
  orb.style.setProperty('bottom','auto','important');
  orb.style.setProperty('width',`${r.width}px`,'important');
  orb.style.setProperty('height',`${r.height}px`,'important');
  orb.style.setProperty('margin','0','important');
  orb.style.setProperty('transform','none','important');
  orb.style.setProperty('animation','none','important');
  orb.style.setProperty('transition','none','important');
  orb.style.setProperty('z-index','50','important');
  glass.appendChild(orb);
  target.classList.add('is-picked');
  return {orb,target,w:r.width,h:r.height,x:r.left,y:r.top};
}
function __placeOrb(pickup,x,y,scale=.96){
  pickup.x=x; pickup.y=y;
  pickup.orb.style.setProperty('left',`${x}px`,'important');
  pickup.orb.style.setProperty('top',`${y}px`,'important');
  pickup.orb.style.setProperty('transform',`scale(${scale})`,'important');
}

async function __animateClawToWinner(winnerId){
  clearAnim();
  document.querySelector('#winnerCard')?.classList.remove('show');
  await new Promise(requestAnimationFrame);
  await new Promise(requestAnimationFrame);

  const glass=document.querySelector('#glassPanel');
  const target=document.querySelector(`#ball-${CSS.escape(String(winnerId))}`);
  const claw=document.querySelector('#claw');
  const cable=claw?.querySelector('.claw-cable');
  if(!glass||!target||!claw||!cable)return;

  const baseCable=68;
  cable.style.height=`${baseCable}px`;
  claw.style.setProperty('--cable-length',`${baseCable}px`);
  claw.classList.add('is-open');
  claw.classList.remove('is-closed','is-dropping','is-lifting');

  const targetBox=__localRect(target,glass);
  const clawBox=__localRect(claw,glass);
  const startX=clawBox.left+clawBox.width/2;
  const desiredX=targetBox.left+targetBox.width/2;
  const half=Math.max(30,clawBox.width/2);
  const pickupX=Math.max(half,Math.min(glass.clientWidth-half,desiredX));
  claw.style.left=`${startX}px`;

  await __tween(1050,p=>{ claw.style.left=`${startX+(pickupX-startX)*p}px`; });
  claw.style.left=`${pickupX}px`;
  await new Promise(requestAnimationFrame);

  const restGrip=__gripLocal(claw,glass,targetBox.width,targetBox.height);
  const neededDrop=Math.max(0,targetBox.top-restGrip.y);
  const maxDrop=Math.max(0,glass.clientHeight-baseCable-125);
  const drop=Math.min(neededDrop,maxDrop);
  const extendedCable=baseCable+drop;

  claw.classList.add('is-dropping');
  await __tween(1350,p=>{
    const h=baseCable+(extendedCable-baseCable)*p;
    cable.style.height=`${h}px`;
    claw.style.setProperty('--cable-length',`${h}px`);
  });
  cable.style.height=`${extendedCable}px`;
  claw.style.setProperty('--cable-length',`${extendedCable}px`);
  await new Promise(requestAnimationFrame);

  claw.classList.remove('is-open');
  claw.classList.add('is-closed');
  await __sleep(300);

  const pickup=__makeCapturedOrb(target,glass);
  const gripAtBottom=__gripLocal(claw,glass,pickup.w,pickup.h);
  const fromX=pickup.x, fromY=pickup.y;
  await __tween(360,p=>{
    __placeOrb(pickup,fromX+(gripAtBottom.x-fromX)*p,fromY+(gripAtBottom.y-fromY)*p,1-.04*p);
  });
  __placeOrb(pickup,gripAtBottom.x,gripAtBottom.y,.96);

  claw.classList.remove('is-dropping');
  claw.classList.add('is-lifting');
  await __tween(1750,p=>{
    const h=extendedCable+(baseCable-extendedCable)*p;
    cable.style.height=`${h}px`;
    claw.style.setProperty('--cable-length',`${h}px`);
    const grip=__gripLocal(claw,glass,pickup.w,pickup.h);
    __placeOrb(pickup,grip.x,grip.y,.96);
  });
  cable.style.height=`${baseCable}px`;
  claw.style.setProperty('--cable-length',`${baseCable}px`);

  const centerX=glass.clientWidth/2;
  await __tween(1150,p=>{
    claw.style.left=`${pickupX+(centerX-pickupX)*p}px`;
    const grip=__gripLocal(claw,glass,pickup.w,pickup.h);
    __placeOrb(pickup,grip.x,grip.y,.96);
  });
  claw.style.left=`${centerX}px`;
  const finalGrip=__gripLocal(claw,glass,pickup.w,pickup.h);
  __placeOrb(pickup,finalGrip.x,finalGrip.y,.96);
}

function animate(winnerId){__animateClawToWinner(winnerId)}

window.addEventListener('resize',()=>layout(state.entrants?.length||0));socket.on('state',render);socket.on('draw:start',({winnerId})=>animate(winnerId));socket.on('draw:winner',showWinner);socket.on('reset',()=>{$('#winnerCard').classList.remove('show');clearAnim()});
