'use strict';
const button = document.getElementById('porch-toggle');
const house = document.querySelector('.house-demo');
const countMessage = document.getElementById('porch-counts');
const motionButton = document.getElementById('motion-toggle');
const motionStatus = document.getElementById('motion-status');
let manualOn = true;
let totals = null;
let motionEnabled = false;
let houseVisible = true;
let motionTimer;
let motionDetected = false;
let scrollFrame = false;
let previousScroll = window.scrollY;
const number = new Intl.NumberFormat();

function setLights(on) {
  button.setAttribute('aria-pressed',String(on));
  house.classList.toggle('lights-off',!on);
  document.getElementById('svg-state').textContent=on?'on':'off';
}
function stopMotion() {
  clearTimeout(motionTimer);
  motionDetected=false;
  house.classList.remove('motion-detected');
  motionStatus.textContent=motionEnabled?'Motion sensor ready. Scroll to try it.':'A little local control.';
  setLights(motionEnabled?false:manualOn);
}
function showCounts(counts) {
  if (!Number.isSafeInteger(counts.off) || counts.off<0 || !Number.isSafeInteger(counts.on) || counts.on<0) throw new Error('Invalid counts');
  totals={off:Math.max(totals?.off||0,counts.off),on:Math.max(totals?.on||0,counts.on)};
  countMessage.replaceChildren();
  for (const [direction,count] of Object.entries(totals)) {
    const line=document.createElement('span');
    line.textContent=direction==='off'
      ? `The community has turned the lights off ${number.format(count)} ${count===1?'time':'times'}.`
      : `And back on ${number.format(count)} ${count===1?'time':'times'}.`;
    countMessage.append(line);
  }
}
async function recordClick(direction) {
  countMessage.hidden=false;
  if (!totals) countMessage.textContent='Counting community clicks…';
  const id=globalThis.crypto?.randomUUID?.();
  if(!id){if(!totals)countMessage.textContent='The light still works. Community counts are unavailable in this browser.';return;}
  const action={direction,id};
  for(let attempt=0;attempt<2;attempt++) {
    try {
      const response=await fetch('/api/porch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(action),signal:AbortSignal.timeout(5000)});
      if (!response.ok) throw new Error('Counter unavailable');
      showCounts(await response.json());
      return;
    } catch {
      // Retry with the same action ID: a lost response must not double-count.
      if (attempt===1 && !totals) countMessage.textContent='The light still works. Community counts are unavailable right now.';
    }
  }
}
button.addEventListener('click',()=>{
  manualOn=button.getAttribute('aria-pressed')!=='true';
  motionEnabled=false;
  motionButton.setAttribute('aria-pressed','false');
  stopMotion();
  void recordClick(manualOn?'on':'off');
});
motionButton.addEventListener('click',()=>{
  motionEnabled=!motionEnabled;
  motionButton.setAttribute('aria-pressed',String(motionEnabled));
  previousScroll=window.scrollY;
  stopMotion();
});
if ('IntersectionObserver' in window) {
  new IntersectionObserver(entries=>{
    houseVisible=entries[0].isIntersecting;
    if(!houseVisible)stopMotion();
  }).observe(house);
}
window.addEventListener('scroll',()=>{
  if (!motionEnabled || !houseVisible || scrollFrame) return;
  scrollFrame=true;
  requestAnimationFrame(()=>{
    scrollFrame=false;
    const current=window.scrollY;
    if(Math.abs(current-previousScroll)<4)return;
    previousScroll=current;
    if(!motionDetected){motionStatus.textContent='Motion detected. Lights on.';motionDetected=true;house.classList.add('motion-detected');}
    setLights(true);
    clearTimeout(motionTimer);
    motionTimer=setTimeout(stopMotion,2000);
  });
},{passive:true});
