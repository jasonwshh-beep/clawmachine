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
  const width=Math.max(120,rect.width-18),height=Math.max(100,rect.height-12);
  if(!count||!balls.length)return;

  let size=90,cols=1,rows=count;
  for(let candidate=90;candidate>=14;candidate-=1){
    const horizontal=candidate*.84;
    const vertical=candidate*.76;
    const possibleCols=Math.max(1,Math.floor((width-candidate*.18)/horizontal));
    const possibleRows=Math.max(1,Math.floor((height-candidate*.18)/vertical));
    if(possibleCols*possibleRows>=count){size=candidate;cols=possibleCols;rows=Math.ceil(count/cols);break}
  }

  const hStep=size*.84,vStep=size*.76;
  const totalRows=Math.ceil(count/cols);
  balls.forEach((el,index)=>{
    const row=Math.floor(index/cols);
    const col=index%cols;
    const inRow=Math.min(cols,count-row*cols);
    const seed=Math.abs(String(el.dataset.entryId||el.id||index).split('').reduce((a,c)=>((a*31)+c.charCodeAt(0))>>>0,7));
    const rowShift=(row%2)*size*.42;
    const rowWidth=(inRow-1)*hStep+size;
    const baseLeft=Math.max(2,(width-rowWidth)/2+rowShift-(row%2&&rowWidth+rowShift>width?size*.42:0));
    const jitterX=((seed%17)-8)*size*.012;
    const jitterY=(((seed>>4)%13)-6)*size*.012;
    el.style.width=`${size}px`;
    el.style.height=`${size}px`;
    el.style.left=`${Math.max(0,Math.min(width-size,baseLeft+col*hStep+jitterX))}px`;
    el.style.bottom=`${Math.max(0,row*vStep+jitterY)}px`;
    el.style.setProperty('--rest-rotation',`${((seed%19)-9)*.75}deg`);
    el.style.zIndex=String(5+row);
  });
  pit.classList.toggle('compact',count>45);
  pit.classList.toggle('dense',count>100);
}
function render(s){state=s;$('#ballPit').innerHTML=s.entrants.map(ball).join('');$('#deckMessage').textContent=s.keyword.toUpperCase();$('#metricEntries').textContent=s.entrants.length;requestAnimationFrame(()=>layout(s.entrants.length));if(s.winner)showWinner(s.winner)}
function showWinner(e){const c=$('#winnerCard');c.innerHTML=`<div class="winner-avatar">${avatar(e)}</div><small>${esc(state.prize)} WINNER</small><h3>${esc(e.username)}</h3><p>Selected from ${state.entrants.length} entries</p>`;c.classList.add('show')}
function clearAnim(){
  timers.forEach(clearTimeout);timers=[];
  const claw=$('#claw');
  claw.classList.remove('is-closed','is-dropping','is-lifting');claw.classList.add('is-open');
  claw.style.left='50%';claw.style.setProperty('--cable-length','78px');
  $('#clawCargo').innerHTML='';
  document.querySelectorAll('.pickup-ball').forEach(el=>el.remove());
}
function later(fn,delay){const id=setTimeout(fn,delay);timers.push(id)}
function attachBallSmoothly(target,glass){
  const cargo=$('#clawCargo');
  const start=target.getBoundingClientRect();
  const gr=glass.getBoundingClientRect();
  const clone=target.cloneNode(true);
  clone.removeAttribute('id');
  clone.classList.remove('is-picked');
  clone.classList.add('pickup-ball');
  Object.assign(clone.style,{left:`${start.left-gr.left}px`,top:`${start.top-gr.top}px`,width:`${start.width}px`,height:`${start.height}px`});
  glass.appendChild(clone);
  target.classList.add('is-picked');
  const cargoRect=cargo.getBoundingClientRect();
  requestAnimationFrame(()=>{
    clone.style.left=`${cargoRect.left+cargoRect.width/2-gr.left-start.width/2}px`;
    clone.style.top=`${cargoRect.top+cargoRect.height/2-gr.top-start.height/2}px`;
    clone.style.transform='scale(.92)';
  });
  later(()=>{
    const before=clone.getBoundingClientRect();
    clone.classList.remove('pickup-ball');
    clone.removeAttribute('style');
    cargo.appendChild(clone);
    const after=clone.getBoundingClientRect();
    const dx=before.left-after.left,dy=before.top-after.top;
    const sx=before.width/Math.max(1,after.width);
    clone.style.transition='none';
    clone.style.transform=`translate(${dx}px,${dy}px) scale(${sx})`;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      clone.style.transition='transform .22s cubic-bezier(.2,.8,.2,1)';
      clone.style.transform='translate(0,0) scale(1)';
    }));
  },560);
}
function animate(winnerId){
  clearAnim();
  $('#winnerCard').classList.remove('show');
  const glass=$('#glassPanel'),target=$(`#ball-${CSS.escape(winnerId)}`),claw=$('#claw');
  if(!glass||!target)return;
  const g=glass.getBoundingClientRect(),b=target.getBoundingClientRect();
  const targetX=((b.left+b.width/2-g.left)/g.width)*100;
  const targetCenter=b.top+b.height/2-g.top;
  const cableLength=Math.max(78,Math.min(g.height-205,targetCenter-145));
  claw.style.left=`${targetX}%`;
  later(()=>{claw.classList.add('is-dropping');claw.style.setProperty('--cable-length',`${cableLength}px`)},1250);
  later(()=>{claw.classList.remove('is-open');claw.classList.add('is-closed')},3000);
  later(()=>attachBallSmoothly(target,glass),3350);
  later(()=>{claw.classList.remove('is-dropping');claw.classList.add('is-lifting');claw.style.setProperty('--cable-length','78px')},4250);
  later(()=>{claw.style.left='50%'},6250);
}
window.addEventListener('resize',()=>layout(state.entrants?.length||0));socket.on('state',render);socket.on('draw:start',({winnerId})=>animate(winnerId));socket.on('draw:winner',showWinner);socket.on('reset',()=>{$('#winnerCard').classList.remove('show');clearAnim()});
