const $=s=>document.querySelector(s);
let ac,master,mode='pad',style='reggae',auto=true,bpm=90;
const held=new Map();let chord=null,lastAct=0,padV=[];
const mf=m=>440*Math.pow(2,(m-69)/12);
function ctx(){if(!ac){ac=new(window.AudioContext||window.webkitAudioContext)();master=ac.createGain();master.gain.value=.7;const c=ac.createDynamicsCompressor();master.connect(c);c.connect(ac.destination)}if(ac.state!=='running')ac.resume()}

/* ---------- chord detection ---------- */
const T=[['',[0,4,7]],['m',[0,3,7]],['7',[0,4,7,10]],['maj7',[0,4,7,11]],['m7',[0,3,7,10]],['dim',[0,3,6]],['aug',[0,4,8]],['sus4',[0,5,7]],['sus2',[0,2,7]]];
const NM=['C','D♭','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
function detect(){
 const ms=[...held.keys()].sort((a,b)=>a-b);if(ms.length<2)return null;
 const pcs=[...new Set(ms.map(m=>m%12))],bass=ms[0]%12;let best=null,bs=-99;
 for(const r of pcs)for(const[n,iv]of T){const tp=iv.map(i=>(r+i)%12),it=tp.filter(p=>pcs.includes(p)).length;if(it<2)continue;
  const s=it*2-(pcs.length-it)*1.5-(iv.length-it)*1.2+(r===bass?1:0)+(iv.length===3?.2:0);
  if(s>bs){bs=s;best={root:r,name:n,iv}}}
 return best}
const ckey=c=>c&&c.root+c.name;

/* ---------- pad ---------- */
function padOn(c){ctx();const t=ac.currentTime;const notes=[36+c.root,...c.iv.map(i=>60+(c.root+i)%12)];
 const g=ac.createGain(),f=ac.createBiquadFilter();f.type='lowpass';f.frequency.value=1000;
 g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.2/Math.sqrt(notes.length),t+.5);g.connect(f);f.connect(master);
 const os=[];notes.forEach(n=>[-8,8].forEach(d=>{const o=ac.createOscillator();o.type='sawtooth';o.frequency.value=mf(n);o.detune.value=d;o.connect(g);o.start(t);os.push(o)}));
 padV.push({g,os})}
function padOff(){if(!ac)return;const t=ac.currentTime;padV.forEach(v=>{v.g.gain.cancelScheduledValues(t);v.g.gain.setValueAtTime(v.g.gain.value,t);v.g.gain.linearRampToValueAtTime(0,t+1.2);v.os.forEach(o=>o.stop(t+1.3))});padV=[]}

/* ---------- ocarina vamp ---------- */
const PAT={
 reggae:[-1,-1,0,-1,-1,-1,1,-1,-1,-1,2,-1,-1,1,0,-1],
 makossa:[0,-1,1,0,-1,2,-1,1,0,-1,2,-1,1,-1,0,2],
 ariaria:[0,-1,-1,1,-1,0,-1,2,-1,1,-1,0,2,-1,1,-1]};
const LEN={reggae:3,makossa:1.5,ariaria:1.8};
let step=0,nextT=0,timer=null,playing=false;
function oc(m,t,dur,vel){const f=mf(m),g=ac.createGain(),o=ac.createOscillator(),h=ac.createOscillator(),hg=ac.createGain(),l=ac.createOscillator(),lg=ac.createGain();
 o.type='sine';h.type='sine';o.frequency.value=f;h.frequency.value=f*2;hg.gain.value=.05;l.frequency.value=5.2;lg.gain.value=f*.005;
 l.connect(lg);lg.connect(o.frequency);o.connect(g);h.connect(hg);hg.connect(g);g.connect(master);
 const pk=.32*vel;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(pk,t+.04);g.gain.linearRampToValueAtTime(pk*.7,t+dur*.6);g.gain.linearRampToValueAtTime(0,t+dur);
 [o,h,l].forEach(x=>{x.start(t);x.stop(t+dur+.05)})}
function playStep(i,t){if(mode!=='ocarina'||!chord)return;let d=PAT[style][i];if(d<0)return;
 if(Math.random()<.2)d+=Math.random()<.5?-1:1;d=Math.max(0,d);
 const n=chord.iv.length,base=66+(((chord.root-66)%12)+12)%12,k=d%n+Math.floor(d/n)*n;
 const midi=base+chord.iv[k%n]+12*Math.floor(k/n),sx=60/bpm/4;
 oc(midi,t,sx*LEN[style],i%4===0?1:.8)}
function sched(){while(nextT<ac.currentTime+.15){playStep(step,nextT);nextT+=60/bpm/4;step=(step+1)%16}}
function vampOn(){if(playing)return;ctx();playing=true;step=0;nextT=ac.currentTime+.1;timer=setInterval(sched,40)}
function vampOff(){playing=false;clearInterval(timer)}

/* ---------- tempo from playing ---------- */
let lastOn=0,iois=[];
function onset(now){const gap=now-lastOn;if(gap>90){if(gap>250&&gap<1100){iois.push(gap);if(iois.length>8)iois.shift();
  if(auto&&iois.length>=3){const s=[...iois].sort((a,b)=>a-b),med=s[s.length>>1];let b=60000/med;while(b<60)b*=2;while(b>150)b/=2;setBpm(bpm*.6+b*.4)}}
  lastOn=now}}
function setBpm(v){bpm=Math.max(50,Math.min(160,Math.round(v)));$('#bpm').textContent=bpm}

/* ---------- note handling ---------- */
function noteOn(m,v){ctx();held.set(m,v);const now=performance.now();lastAct=now;onset(now);update();paint()}
function noteOff(m){held.delete(m);paint()}
function update(){const c=detect();
 if(c&&ckey(c)!==ckey(chord)){chord=c;$('#cn').textContent=NM[c.root]+c.name;$('#cs').textContent='Following your chord';if(mode==='pad')padOff()}
 if(mode==='pad'&&chord&&!padV.length)padOn(chord);
 if(mode==='ocarina'&&chord)vampOn()}
setInterval(()=>{const idle=performance.now()-lastAct;
 if(mode==='pad'&&padV.length&&!held.size&&idle>2500)padOff();
 if(playing&&idle>8000)vampOff()},400);

/* ---------- on-screen piano ---------- */
const pi=$('#piano'),keyEls={};const WH=[0,2,4,5,7,9,11],BL={1:0,3:1,6:3,8:4,10:5};
let wi=0;const NW=14;
for(let o=0;o<2;o++){for(let k=0;k<7;k++){const m=60+o*12+WH[k],e=document.createElement('div');e.className='w';e.dataset.m=m;pi.appendChild(e);keyEls[m]=e;}}
for(let o=0;o<2;o++)for(const pc in BL){const m=60+o*12+ +pc,e=document.createElement('div');e.className='b';e.dataset.m=m;e.style.left=((o*7+BL[pc]+1)/NW*100)+'%';pi.appendChild(e);keyEls[m]=e}
const down=new Map();
pi.addEventListener('pointerdown',e=>{const t=e.target.closest('[data-m]');if(!t)return;e.preventDefault();const m=+t.dataset.m;down.set(e.pointerId,m);noteOn(m,90)});
const up=e=>{if(down.has(e.pointerId)){noteOff(down.get(e.pointerId));down.delete(e.pointerId)}};
['pointerup','pointercancel','pointerleave'].forEach(n=>pi.addEventListener(n,up));
function paint(){for(const m in keyEls)keyEls[m].classList.toggle('on',held.has(+m))}
const KM={a:60,w:61,s:62,e:63,d:64,f:65,t:66,g:67,y:68,h:69,u:70,j:71,k:72};
addEventListener('keydown',e=>{if(e.repeat||e.metaKey||e.ctrlKey)return;const m=KM[e.key.toLowerCase()];if(m!==undefined)noteOn(m,90)});
addEventListener('keyup',e=>{const m=KM[e.key.toLowerCase()];if(m!==undefined)noteOff(m)});

/* ---------- MIDI ---------- */
function onMsg(e){const[s,a,b]=e.data,c=s&0xf0;if(c===0x90&&b>0)noteOn(a,b);else if(c===0x80||(c===0x90&&b===0))noteOff(a)}
$('#conn').onclick=async()=>{ctx();
 if(!navigator.requestMIDIAccess){$('#st').textContent='This browser can’t read MIDI. Open this page in Chrome on Android.';return}
 try{const a=await navigator.requestMIDIAccess();
  const hook=()=>{const n=[];a.inputs.forEach(i=>{i.onmidimessage=onMsg;n.push(i.name)});
   $('#st').textContent=n.length?'Connected: '+n.join(', '):'No keyboard found. Plug it in, or turn on its Bluetooth MIDI.'};
  hook();a.onstatechange=hook}
 catch(err){$('#st').textContent='MIDI access was blocked. Allow it in the browser prompt, then try again.'}};

/* ---------- controls ---------- */
function seg(id,fn){$(id).addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
 $(id).querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b));fn(b.dataset.v)})}
seg('#mode',v=>{mode=v;padOff();vampOff();if(chord&&held.size)update()});
seg('#style',v=>{style=v});
$('#dn').onclick=()=>{auto=false;syncAuto();setBpm(bpm-4)};
$('#up').onclick=()=>{auto=false;syncAuto();setBpm(bpm+4)};
$('#auto').onclick=()=>{auto=!auto;syncAuto()};
function syncAuto(){const b=$('#auto');b.setAttribute('aria-pressed',auto);b.textContent='Auto: '+(auto?'on':'off')}

if("serviceWorker" in navigator){addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}))}
