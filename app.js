'use strict';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const wait=ms=>new Promise(r=>setTimeout(r,Math.max(0,ms)));
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const store={get(k,d){try{const v=localStorage.getItem('mordomo2_'+k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem('mordomo2_'+k,JSON.stringify(v))}catch(e){}}};
const S=Object.assign({master:.9,music:.5,sfx:.9,duck:.15,lead:400,rise:1.5,shuffle:false,btn:{},custom:[]},store.get('s',{}));
const save=()=>store.set('s',S);

/* ---------- Buttons ---------- */
const BTNS=[
 {g:'Signals',id:'bell',icon:'🔔',name:'Dinner bell',synth:'handbell'},
 {g:'Signals',id:'silence',icon:'🤫',name:'Silence',synth:'towerbell',after:'hold'},
 {g:'Signals',id:'vote',icon:'🗳️',name:'Vote',synth:'gong',after:'hold',cls:'gold'},
 {g:'Signals',id:'served',icon:'🍽️',name:'Course served',synth:'clink'},
 {g:'Night',id:'eyesclosed',icon:'🌑',name:'Eyes Closed',synth:'night',after:'hold',cls:'night'},
 {g:'Night',id:'traitors',icon:'🗡️',name:'Traitors wake',synth:'heartbeat',cls:'night'},
 {g:'Night',id:'seer',icon:'👁️',name:'Seer wakes',synth:'shimmer',cls:'night'},
 {g:'Night',id:'guardian',icon:'🛡️',name:'Guardian wakes',synth:'grace',cls:'night'},
 {g:'Night',id:'eyesopen',icon:'🌅',name:'Eyes Open',synth:'chime',after:'restore'},
 {g:'Reveal',id:'poisoned',icon:'☠️',name:'Poisoned',synth:'sting',cls:'blood'},
 {g:'Reveal',id:'saved',icon:'🕊️',name:'Nobody died',synth:'grace',cls:'green'},
 {g:'Reveal',id:'drumroll',icon:'🥁',name:'Drumroll',synth:'drumroll'},
 {g:'Reveal',id:'banished',icon:'⚖️',name:'Banished',synth:'knell'},
 {g:'Reveal',id:'traitorout',icon:'🎺',name:'It was a Traitor',synth:'fanfare',cls:'green'},
 {g:'Reveal',id:'innocent',icon:'🥀',name:'It was innocent',synth:'doom',cls:'blood'},
 {g:'Endings',id:'housewins',icon:'🏰',name:'House wins',synth:'triumph',after:'restore',cls:'green'},
 {g:'Endings',id:'traitorswin',icon:'🐍',name:'Traitors win',synth:'fall',after:'restore',cls:'blood'},
 {g:'Endings',id:'toast',icon:'🥂',name:'Toast',synth:'clink'},
 {g:'Endings',id:'parabens',icon:'🎂',name:'Parabéns',synth:'birthday',cls:'gold'},
 {g:'Atmosphere',id:'heartbeat',icon:'❤️',name:'Heartbeat',synth:'heartbeat'},
 {g:'Atmosphere',id:'thunder',icon:'⛈️',name:'Thunder',synth:'thunder'},
 {g:'Atmosphere',id:'wolf',icon:'🐺',name:'Wolf',synth:'wolf'},
 {g:'Atmosphere',id:'owl',icon:'🦉',name:'Owl',synth:'owl'},
 {g:'Atmosphere',id:'applause',icon:'👏',name:'Applause',synth:'applause'},
 {g:'Atmosphere',id:'gong',icon:'🌕',name:'Gong',synth:'gong'}
];
const GROUPS=['Signals','Night','Reveal','Endings','Atmosphere','Mine'];
const defOf=id=>BTNS.find(b=>b.id===id)||S.custom.find(b=>b.id===id);
function cfgOf(id){const d=defOf(id)||{};return Object.assign({name:d.name,icon:d.icon,after:d.after||'auto',loop:false,vol:1,file:''},S.btn[id]||{})}
function setCfg(id,patch){S.btn[id]=Object.assign({},S.btn[id]||{},patch);save()}

/* ---------- Audio core ---------- */
let ctx=null,out,duckG,musicBus,sfxBus,verb,noiseBuf,OUT=null;
function makeNoise(sec){const b=ctx.createBuffer(1,ctx.sampleRate*sec,ctx.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;return b}
function makeImpulse(sec,decay){const n=ctx.sampleRate*sec,b=ctx.createBuffer(2,n,ctx.sampleRate);for(let c=0;c<2;c++){const d=b.getChannelData(c);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/n,decay)}return b}
function initAudio(){
  if(ctx){if(ctx.state!=='running')ctx.resume();return}
  try{if(navigator.audioSession)navigator.audioSession.type='playback'}catch(e){}
  ctx=new(window.AudioContext||window.webkitAudioContext)();
  const comp=ctx.createDynamicsCompressor();comp.threshold.value=-10;comp.ratio.value=4;comp.attack.value=.005;comp.release.value=.25;
  out=ctx.createGain();out.gain.value=S.master;out.connect(comp);comp.connect(ctx.destination);
  duckG=ctx.createGain();duckG.connect(out);
  musicBus=ctx.createGain();musicBus.gain.value=S.music;musicBus.connect(duckG);
  sfxBus=ctx.createGain();sfxBus.gain.value=S.sfx;sfxBus.connect(out);
  verb=ctx.createConvolver();verb.buffer=makeImpulse(3,2.6);verb.connect(sfxBus);
  noiseBuf=makeNoise(8);plConnect();
}
const now=()=>ctx.currentTime+.02;
function mkGain(v,dest){const g=ctx.createGain();g.gain.value=v;g.connect(dest);return g}
function sfxOut(wet=.3){const tgt=OUT||sfxBus,g=ctx.createGain();g.connect(tgt);if(wet){const s=ctx.createGain();s.gain.value=wet;g.connect(s);s.connect(verb)}return g}
function env(p,t,a,peak,d){p.setValueAtTime(.0001,t);p.exponentialRampToValueAtTime(Math.max(peak,.0002),t+a);p.exponentialRampToValueAtTime(.0001,t+a+d)}
function tone(type,f,t,dur,dest){const o=ctx.createOscillator();o.type=type;o.frequency.setValueAtTime(f,t);o.connect(dest);o.start(t);o.stop(t+dur+.05);return o}
function noise(t,dur,dest,type,freq,q){const s=ctx.createBufferSource();s.buffer=noiseBuf;const f=ctx.createBiquadFilter();f.type=type;f.frequency.value=freq;f.Q.value=q;s.connect(f);f.connect(dest);const len=Math.min(dur+.05,7.8);s.start(t,Math.random()*(7.9-len),len)}
function hit(t,dur,dest,vol,type='bandpass',freq=1000,q=1,a=.002){const g=mkGain(0,dest);env(g.gain,t,a,vol,dur);noise(t,a+dur,g,type,freq,q)}

/* ---------- Placeholder synths ---------- */
function bell(f,t,dur,vol,d){d=d||sfxOut(.4);[[1,1],[2,.55],[2.76,.4],[4.07,.22],[5.4,.18],[.5,.3]].forEach(([r,a],i)=>{const g=mkGain(0,d),l=dur/(1+i*.5);env(g.gain,t,.002,vol*a,l);tone('sine',f*r,t,l+.01,g)})}
function drum(t,f,vol,decay,d){d=d||sfxOut(.2);const g=mkGain(0,d);env(g.gain,t,.003,vol,decay);const o=tone('sine',f*2.2,t,decay+.05,g);o.frequency.exponentialRampToValueAtTime(f,t+.06);hit(t,.05,d,vol*.25,'bandpass',f*8,1)}
function harp(f,t,v,d){const g=mkGain(0,d);env(g.gain,t,.005,v,2.6);tone('sine',f,t,2.7,g);tone('triangle',f*2,t,2.7,mkGain(.25,g))}
function brass(f,t,dur,vol,d){const g=mkGain(0,d);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+.04);g.gain.setValueAtTime(vol,t+dur-.05);g.gain.exponentialRampToValueAtTime(.0001,t+dur+.25);const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.Q.value=2;lp.frequency.setValueAtTime(f*1.2,t);lp.frequency.exponentialRampToValueAtTime(f*6,t+.06);lp.frequency.exponentialRampToValueAtTime(f*3,t+dur);lp.connect(g);[-6,6].forEach(c=>{tone('sawtooth',f,t,dur+.3,lp).detune.value=c})}
function hoo(t,l,d,v){const g=mkGain(0,d);env(g.gain,t,.06,v,l);const o=tone('sine',360,t,l+.1,g);o.frequency.linearRampToValueAtTime(400,t+l*.4);o.frequency.linearRampToValueAtTime(340,t+l)}
const SYN={
handbell(t){const d=sfxOut(.35);for(let b=0;b<2;b++)for(let k=0;k<6;k++)bell(1567+(k%2)*3,t+b*1.25+k*.14+Math.random()*.02,1.5,k%2?.16:.24,d);return 3.2},
towerbell(t){const d=sfxOut(.6);for(let k=0;k<3;k++)bell(196,t+k*1.5,6,.45,d);return 7.5},
gong(t){const d=sfxOut(.5),f=70;[[1,1],[1.48,.5],[2.13,.45],[2.9,.3],[3.6,.2],[4.95,.12]].forEach(([r,a],i)=>{const g=mkGain(0,d);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.4*a,t+.02+i*.04);g.gain.exponentialRampToValueAtTime(.0001,t+7-i*.6);const o=tone('sine',f*r,t,7.2,g);o.frequency.exponentialRampToValueAtTime(f*r*.985,t+6)});hit(t,.6,d,.3,'lowpass',900,.5);return 6},
night(t){const d=sfxOut(.6);[55,82.41].forEach(f=>{const g=mkGain(0,d);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.12,t+1.5);g.gain.exponentialRampToValueAtTime(.0001,t+6);const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=300;lp.connect(g);tone('sawtooth',f,t,6.1,lp)});bell(98,t+.2,6,.35,d);return 6},
drumroll(t){const d=sfxOut(.3),n=64;for(let i=0;i<n;i++)hit(t+i*.045,.06,d,.05+.35*(i/n),'bandpass',1800+Math.random()*400,.8);const e=t+n*.045;drum(e,70,.9,.6,d);hit(e,2.5,d,.25,'highpass',5000,.5);return 5},
heartbeat(t){const d=sfxOut(.15);for(let i=0;i<6;i++){drum(t+i*.85,55,.9-i*.05,.22,d);drum(t+i*.85+.26,50,.6,.28,d)}return 5.1},
thunder(t){const d=sfxOut(.5);hit(t,.15,d,.5,'lowpass',2000,.5);for(let i=0;i<5;i++)hit(t+.1+i*.5+Math.random()*.4,1.5+Math.random()*2,d,.5-i*.07,'lowpass',180+Math.random()*120,.8,.08);return 6},
sting(t){const d=sfxOut(.5);[[220,0],[233.08,.02],[311.13,.04],[466.16,0],[110,0]].forEach(([f,o])=>{const g=mkGain(0,d);env(g.gain,t+o,.03,.09,2.8);const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.setValueAtTime(3000,t);lp.frequency.exponentialRampToValueAtTime(400,t+2.5);lp.connect(g);[-8,8].forEach(c=>{tone('sawtooth',f,t+o,3,lp).detune.value=c})});drum(t,45,.9,.8,d);return 3.3},
chime(t){const d=sfxOut(.5);[1318.5,1568,1975.5,2637].forEach((f,i)=>bell(f,t+i*.13,2.5,.12,d));return 2.8},
grace(t){const d=sfxOut(.5);[523.25,659.25,783.99,1046.5,1318.5].forEach((f,i)=>harp(f,t+i*.12,.16,d));return 3},
shimmer(t){const d=sfxOut(.6);[1760,1864.66,2217.46,2637].forEach((f,i)=>{const g=mkGain(0,d);env(g.gain,t+i*.15,1,.03,2.5);tone('sine',f,t+i*.15,3.6,g)});return 3.6},
knell(t){const d=sfxOut(.6);bell(130.8,t,5,.45,d);bell(130.8,t+1.6,5,.4,d);return 5.5},
fanfare(t){const d=sfxOut(.35),v=.12;[[0,.14,392],[.18,.14,392],[.36,.14,392],[.54,.9,523.25],[1.5,.14,523.25],[1.68,.14,659.25],[1.86,1.6,783.99]].forEach(([o,l,f])=>brass(f,t+o,l,v,d));brass(659.25,t+.54,.9,v*.7,d);brass(659.25,t+1.86,1.6,v*.7,d);brass(523.25,t+1.86,1.6,v*.6,d);drum(t+.54,90,.6,.5,d);drum(t+1.86,80,.8,.8,d);return 3.8},
doom(t){const d=sfxOut(.5);[73.42,87.31,110,146.83].forEach(f=>{const g=mkGain(0,d);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.09,t+1);g.gain.exponentialRampToValueAtTime(.0001,t+4.5);const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=500;lp.connect(g);tone('sawtooth',f,t,4.6,lp)});SYN.gong(t);return 5},
triumph(t){SYN.fanfare(t);SYN.applause(t+2.4);return 6.4},
fall(t){SYN.thunder(t);SYN.doom(t+1.2);return 6.5},
wolf(t){const d=sfxOut(.6);[[0,1],[1.2,.85]].forEach(([o,s])=>{const tt=t+o,g=mkGain(0,d);g.gain.setValueAtTime(.0001,tt);g.gain.exponentialRampToValueAtTime(.16*s,tt+.4);g.gain.setValueAtTime(.16*s,tt+2.2);g.gain.exponentialRampToValueAtTime(.0001,tt+3.2);const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=1400;lp.connect(g);const o1=tone('triangle',300*s,tt,3.3,lp);o1.frequency.exponentialRampToValueAtTime(560*s,tt+.6);o1.frequency.linearRampToValueAtTime(520*s,tt+2.2);o1.frequency.exponentialRampToValueAtTime(360*s,tt+3.2);tone('sine',5.5,tt,3.3,mkGain(9,o1.frequency))});return 4.5},
owl(t){const d=sfxOut(.6);hoo(t,.45,d,.25);hoo(t+.75,.2,d,.18);hoo(t+1.05,.5,d,.22);return 1.8},
clink(t){const d=sfxOut(.3);[0,.09].forEach(o=>[2637,3520,4186,5587].forEach((f,i)=>{const g=mkGain(0,d);env(g.gain,t+o,.001,.08/(i+1)*(o?.7:1),1.2-i*.2);tone('sine',f*(1+Math.random()*.004),t+o,1.3,g)}));return 1.4},
applause(t){const d=sfxOut(.2),len=4;for(let i=0;i<260;i++){const tt=t+Math.random()*len,e=Math.min(1,(tt-t)/.4)*Math.min(1,(t+len-tt)/1.2);hit(tt,.03,d,.12*e+.01,'bandpass',900+Math.random()*1800,1.5,.001)}return len},
birthday(t){const d=sfxOut(.35),b=.48,N={G4:392,A4:440,B4:493.88,C5:523.25,D5:587.33,E5:659.25,F5:698.46,G5:783.99};
  const mel=[['G4',.75],['G4',.25],['A4',1],['G4',1],['C5',1],['B4',2],['G4',.75],['G4',.25],['A4',1],['G4',1],['D5',1],['C5',2],['G4',.75],['G4',.25],['G5',1],['E5',1],['C5',1],['B4',1],['A4',2],['F5',.75],['F5',.25],['E5',1],['C5',1],['D5',1],['C5',3]];
  let tt=t;mel.forEach(([n,l])=>{harp(N[n],tt,.22,d);tt+=l*b});return tt-t+1},
empty(t){hit(t,.03,sfxOut(0),.3,'highpass',2500,1);return .2},
tick(t,hi){hit(t,.03,sfxOut(0),.4,'highpass',hi?3500:2200,1);return .1}
};

/* ---------- Storage ---------- */
const DB={db:null,
open(){return new Promise(res=>{try{const r=indexedDB.open('mordomo',2);r.onupgradeneeded=()=>{['tracks','sounds'].forEach(n=>{if(!r.result.objectStoreNames.contains(n))r.result.createObjectStore(n,{keyPath:'id'})})};r.onsuccess=()=>{this.db=r.result;res(true)};r.onerror=()=>res(false)}catch(e){res(false)}})},
req(st,mode,fn){return new Promise(res=>{try{const tx=this.db.transaction(st,mode),q=fn(tx.objectStore(st));tx.oncomplete=()=>res(q&&q.result!==undefined?q.result:true);tx.onerror=()=>res(null)}catch(e){res(null)}})},
all(st){return this.req(st,'readonly',s=>s.getAll()).then(r=>Array.isArray(r)?r:[])},
get(st,id){return this.req(st,'readonly',s=>s.get(id))},
put(st,o){return this.req(st,'readwrite',s=>s.put(o))},
del(st,id){return this.req(st,'readwrite',s=>s.delete(id))}};

/* ---------- Sound files ---------- */
const BUF=new Map(),REPO=new Map();
function decode(ab){return new Promise((res,rej)=>{try{const p=ctx.decodeAudioData(ab,res,rej);if(p&&p.then)p.then(res,rej)}catch(e){rej(e)}})}
async function loadUserSound(id){const rec=DB.db?await DB.get('sounds',id):null;if(rec&&rec.blob){try{BUF.set(id,await decode(await rec.blob.arrayBuffer()));return}catch(e){}}BUF.delete(id)}
async function preloadAll(){if(DB.db){const recs=await DB.all('sounds');for(const r of recs){try{BUF.set(r.id,await decode(await r.blob.arrayBuffer()))}catch(e){}}}
  if(location.protocol.startsWith('http'))await Promise.all(BTNS.map(async b=>{for(const ext of ['mp3','m4a','wav','ogg']){try{const r=await fetch('sounds/'+b.id+'.'+ext,{cache:'no-cache'});if(r.ok){REPO.set(b.id,await decode(await r.arrayBuffer()));break}}catch(e){}}}));
  renderBoard()}
const bufferFor=id=>BUF.get(id)||REPO.get(id)||null;

/* ---------- Ducking ---------- */
let held=false,ducked=false;
function musicAudible(){return P.el&&!P.el.paused}
function duckTo(low){if(!ctx)return;const t=ctx.currentTime;duckG.gain.cancelScheduledValues(t);duckG.gain.setValueAtTime(duckG.gain.value,t);
  if(low)duckG.gain.linearRampToValueAtTime(S.duck,t+Math.max(.05,S.lead/1000*.9));else duckG.gain.linearRampToValueAtTime(1,t+S.rise);ducked=low}
function renderHold(){$('#holdPill').hidden=!held}
function maybeRaise(){if(!active.size&&!held)duckTo(false)}

/* ---------- Playing ---------- */
const active=new Map();let trigTok=0;
async function trigger(id,preview){
  initAudio();
  if(active.has(id)){active.get(id).stop();return}
  const c=cfgOf(id),d=defOf(id);
  const needLead=musicAudible()&&!ducked;
  duckTo(true);
  const h={stopped:false,stop:null};active.set(id,h);markPlaying(id,true);
  if(needLead)await wait(S.lead);
  if(h.stopped)return;
  const g=mkGain(c.vol,sfxBus),buf=bufferFor(id);
  let finishTimer=null,loopTimer=null,src=null;
  const finish=()=>{if(!active.has(id)||active.get(id)!==h)return;active.delete(id);markPlaying(id,false);clearTimeout(finishTimer);clearInterval(loopTimer);
    if(!preview){if(c.after==='hold')held=true;if(c.after==='restore')held=false;renderHold()}maybeRaise()};
  h.stop=()=>{h.stopped=true;clearTimeout(finishTimer);clearInterval(loopTimer);const t=ctx.currentTime;g.gain.cancelScheduledValues(t);g.gain.setValueAtTime(g.gain.value,t);g.gain.linearRampToValueAtTime(0,t+.25);if(src)try{src.stop(t+.3)}catch(e){}setTimeout(()=>{try{g.disconnect()}catch(e){}},400);finish()};
  if(buf){src=ctx.createBufferSource();src.buffer=buf;src.loop=!!c.loop;src.connect(g);src.onended=()=>{if(!h.stopped)finish()};src.start()}
  else{const play=()=>{OUT=g;const dur=SYN[d&&d.synth||'empty'](now());OUT=null;return dur};const dur=play();
    if(c.loop)loopTimer=setInterval(play,dur*1000);else finishTimer=setTimeout(finish,dur*1000)}
}
function markPlaying(id,on){const b=$(`.sb[data-id="${id}"]`);if(b)b.classList.toggle('playing',on)}
function stopAll(){[...active.values()].forEach(h=>h.stop&&h.stop());active.clear();$$('.sb.playing').forEach(b=>b.classList.remove('playing'));stopTimer();if(P.el)P.el.pause();held=false;renderHold();if(ctx){const o=sfxBus;o.gain.setTargetAtTime(0,ctx.currentTime,.05);sfxBus=ctx.createGain();sfxBus.gain.value=S.sfx;sfxBus.connect(out);verb.disconnect();verb.connect(sfxBus);setTimeout(()=>{try{o.disconnect()}catch(e){}},500);duckTo(false)}renderMusic()}

/* ---------- Playlist ---------- */
const P={tracks:[],i:0,el:new Audio(),url:null,src:null};
P.el.preload='auto';
P.el.addEventListener('ended',()=>plNext());
P.el.addEventListener('play',renderMusic);P.el.addEventListener('pause',renderMusic);
function plConnect(){if(!P.src&&ctx){try{P.src=ctx.createMediaElementSource(P.el);P.src.connect(musicBus)}catch(e){}}}
async function plLoad(){if(DB.db)P.tracks=(await DB.all('tracks')).sort((a,b)=>a.order-b.order);renderMusic()}
function plPlay(i){if(!P.tracks.length){renderMusic();return}initAudio();if(i!=null)P.i=(i+P.tracks.length)%P.tracks.length;P.i=Math.min(P.i,P.tracks.length-1);if(P.url)URL.revokeObjectURL(P.url);P.url=URL.createObjectURL(P.tracks[P.i].blob);P.el.src=P.url;P.el.play().catch(()=>{});renderMusic()}
function plNext(){if(S.shuffle&&P.tracks.length>1){let j;do{j=Math.floor(Math.random()*P.tracks.length)}while(j===P.i);plPlay(j)}else plPlay(P.i+1)}
async function plMove(i,dir){const j=i+dir;if(j<0||j>=P.tracks.length)return;const a=P.tracks[i],b=P.tracks[j];[a.order,b.order]=[b.order,a.order];P.tracks[i]=b;P.tracks[j]=a;if(P.i===i)P.i=j;else if(P.i===j)P.i=i;await DB.put('tracks',a);await DB.put('tracks',b);renderMusic()}

/* ---------- Timer ---------- */
const T={end:0,id:null,last:-1};
const fmt=s=>Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
function startTimer(secs){stopTimer();T.end=Date.now()+secs*1000;T.last=-1;$('#timerBar').hidden=false;T.id=setInterval(tmTick,200);tmTick()}
function stopTimer(){clearInterval(T.id);T.id=null;$('#timerBar').hidden=true;$('#timerBar').classList.remove('late')}
function tmTick(){const left=Math.max(0,Math.ceil((T.end-Date.now())/1000));$('#tTime').textContent=fmt(left);$('#timerBar').classList.toggle('late',left<=10);
  if(left<=10&&left>0&&left!==T.last){T.last=left;if(ctx){OUT=null;SYN.tick(now(),left%2)}}
  if(left<=0){stopTimer();trigger('bell')}}

/* ---------- Wake lock ---------- */
let wl=null,started=false;
async function keepAwake(){try{if('wakeLock' in navigator&&document.visibilityState==='visible'){wl=await navigator.wakeLock.request('screen')}}catch(e){wl=null}}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&started){keepAwake();if(ctx&&ctx.state!=='running')ctx.resume()}});
document.addEventListener('pointerdown',()=>{if(ctx&&ctx.state!=='running')ctx.resume()},{passive:true});

/* ---------- Rendering ---------- */
let editing=false,editId=null;
function srcLabel(id){if(BUF.has(id))return['mine','Your file'];if(REPO.has(id))return['mine','Repo file'];if(S.custom.some(c=>c.id===id))return['','No sound yet'];return['','Placeholder']}
function renderBoard(){
  const all=[...BTNS,...S.custom.map(c=>Object.assign({g:'Mine'},c))];
  $('#board').innerHTML=GROUPS.map(g=>{const items=all.filter(b=>b.g===g);if(g!=='Mine'&&!items.length)return'';if(g==='Mine'&&!items.length&&!editing)return'';
    return `<h2>${g}</h2><div class="grid">`+items.map(b=>{const c=cfgOf(b.id),[cls,lab]=srcLabel(b.id);
      const sub=c.after==='hold'?'Music stays low':c.after==='restore'?'Music back up':(c.loop?'Loops':'');
      return `<button class="sb ${b.cls||''} ${active.has(b.id)?'playing':''}" data-id="${b.id}"><span class="ic">${esc(c.icon||'🎵')}</span><b>${esc(c.name||'Sound')}</b>${sub?`<small>${sub}</small>`:''}${editing?`<span class="badge ${cls}">${lab}</span>`:''}</button>`}).join('')+
      (g==='Mine'&&editing?`<button class="sb add" id="addBtn"><span class="ic">＋</span><b>Add a button</b></button>`:'')+'</div>'}).join('');
}
function renderMusic(){
  const tr=P.tracks[P.i];$('#nowName').textContent=tr&&P.el.src?tr.name:(P.tracks.length?'Press play':'Add songs below');
  $('#plPlay').textContent=P.el.paused?'▶':'⏸';$('#plShuf').classList.toggle('on',S.shuffle);
  $('#plList').innerHTML=P.tracks.map((t,i)=>`<li class="${i===P.i&&P.el.src?'cur':''}"><b data-play="${i}">${esc(t.name)}</b><button data-up="${i}" aria-label="Move up">↑</button><button data-del="${t.id}">Remove</button></li>`).join('');
}
function renderSetup(){
  $$('[data-vol]').forEach(r=>{r.value=S[r.dataset.vol];$('#v_'+r.dataset.vol).textContent=Math.round(S[r.dataset.vol]*100)+'%'});
  $('#lead').value=S.lead;$('#v_lead').textContent=(S.lead/1000).toFixed(2)+' s';
  $('#rise').value=S.rise;$('#v_rise').textContent=S.rise.toFixed(1)+' s';
  $('#idList').innerHTML=BTNS.map(b=>`<code>${b.id}</code>`).join(' ');
}
$('#timerChips').innerHTML=[[30,'30 s'],[60,'1 min'],[90,'90 s'],[120,'2 min'],[180,'3 min'],[300,'5 min']].map(([s,l])=>`<button class="chip" data-timer="${s}">${l}</button>`).join('');

/* ---------- Edit sheet ---------- */
function openSheet(id){editId=id;const c=cfgOf(id),[,lab]=srcLabel(id);
  $('#shName').value=c.name||'';$('#shIcon').value=c.icon||'';
  $('#shSrc').textContent='Sound: '+(BUF.has(id)?'your file ('+(c.file||'uploaded')+')':REPO.has(id)?'file from the repo':lab.toLowerCase());
  $$('#shAfter button').forEach(b=>b.classList.toggle('on',b.dataset.after===c.after));
  $('#shLoop').checked=!!c.loop;$('#shVol').value=c.vol;$('#v_btn').textContent=Math.round(c.vol*100)+'%';
  $('#shReset').hidden=!BUF.has(id);$('#shDel').hidden=!S.custom.some(x=>x.id===id);$('#sheet').hidden=false}
function closeSheet(){$('#sheet').hidden=true;editId=null;renderBoard()}
$('#shClose').onclick=closeSheet;
$('#sheet').addEventListener('click',e=>{if(e.target.id==='sheet')closeSheet()});
$('#shName').oninput=e=>setCfg(editId,{name:e.target.value});
$('#shIcon').oninput=e=>setCfg(editId,{icon:e.target.value});
$('#shLoop').onchange=e=>setCfg(editId,{loop:e.target.checked});
$('#shVol').oninput=e=>{setCfg(editId,{vol:+e.target.value});$('#v_btn').textContent=Math.round(e.target.value*100)+'%'};
$('#shAfter').onclick=e=>{const b=e.target.closest('[data-after]');if(!b)return;setCfg(editId,{after:b.dataset.after});$$('#shAfter button').forEach(x=>x.classList.toggle('on',x===b))};
$('#shTest').onclick=()=>trigger(editId,true);
$('#shFile').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;initAudio();const id=editId;
  try{BUF.set(id,await decode(await f.arrayBuffer()))}catch(err){alert('This phone cannot play that file. Try mp3 or m4a.');return}
  const ok=DB.db&&await DB.put('sounds',{id,blob:f,name:f.name});setCfg(id,{file:f.name});
  if(!ok)alert('The sound works now but could not be saved, so it will be gone after a reload.');openSheet(id)};
$('#shReset').onclick=async()=>{await DB.del('sounds',editId);BUF.delete(editId);setCfg(editId,{file:''});openSheet(editId)};
$('#shDel').onclick=async()=>{if(!confirm('Delete this button?'))return;const id=editId;S.custom=S.custom.filter(c=>c.id!==id);delete S.btn[id];save();await DB.del('sounds',id);BUF.delete(id);closeSheet()};

/* ---------- Events ---------- */
document.addEventListener('click',e=>{
  if(e.target.closest('#addBtn')){const id='c'+Date.now().toString(36);S.custom.push({id,icon:'🎵',name:'New sound'});save();renderBoard();openSheet(id);return}
  const sb=e.target.closest('.sb[data-id]');if(sb){if(editing)openSheet(sb.dataset.id);else trigger(sb.dataset.id);return}
  const tb=e.target.closest('[data-tab]');if(tb){$$('.tabs button').forEach(b=>b.classList.toggle('on',b===tb));['sounds','music','setup'].forEach(n=>$('#tab-'+n).hidden=n!==tb.dataset.tab);window.scrollTo(0,0);return}
  const tm=e.target.closest('[data-timer]');if(tm){initAudio();startTimer(+tm.dataset.timer);return}
  const pl=e.target.closest('[data-play]');if(pl){plPlay(+pl.dataset.play);return}
  const up=e.target.closest('[data-up]');if(up){plMove(+up.dataset.up,-1);return}
  const dl=e.target.closest('[data-del]');if(dl){const id=dl.dataset.del,i=P.tracks.findIndex(t=>t.id===id);DB.del('tracks',id);if(i===P.i){P.el.pause();P.el.removeAttribute('src')}P.tracks.splice(i,1);if(P.i>i)P.i--;if(P.i>=P.tracks.length)P.i=0;renderMusic();return}
});
$$('[data-vol]').forEach(r=>r.addEventListener('input',()=>{const k=r.dataset.vol;S[k]=+r.value;save();$('#v_'+k).textContent=Math.round(r.value*100)+'%';if(!ctx)return;const n={master:out,music:musicBus,sfx:sfxBus}[k];if(n)n.gain.setTargetAtTime(S[k],ctx.currentTime,.05);if(k==='duck'&&ducked)duckG.gain.setTargetAtTime(S.duck,ctx.currentTime,.1)}));
$('#lead').oninput=e=>{S.lead=+e.target.value;save();$('#v_lead').textContent=(S.lead/1000).toFixed(2)+' s'};
$('#rise').oninput=e=>{S.rise=+e.target.value;save();$('#v_rise').textContent=S.rise.toFixed(1)+' s'};
$('#editBtn').onclick=()=>{editing=!editing;document.body.classList.toggle('edit',editing);$('#editBtn').classList.toggle('on',editing);$('#editBtn').textContent=editing?'Done':'Edit';$('#editHint').hidden=!editing;renderBoard()};
$('#holdPill').onclick=()=>{held=false;renderHold();maybeRaise()};
$('#stopAll').onclick=stopAll;
$('#tStop').onclick=stopTimer;
$('#testSpk').onclick=()=>trigger('bell',true);
$('#resetAll').onclick=async()=>{if(!confirm('Remove all your uploaded button sounds and settings? Songs stay.'))return;for(const id of [...BUF.keys()])await DB.del('sounds',id);BUF.clear();S.btn={};S.custom=[];save();renderBoard()};
$('#plPlay').onclick=()=>{initAudio();if(!P.el.src)plPlay();else if(P.el.paused)P.el.play().catch(()=>{});else P.el.pause()};
$('#plNext').onclick=()=>plNext();
$('#plPrev').onclick=()=>plPlay(P.i-1);
$('#plShuf').onclick=()=>{S.shuffle=!S.shuffle;save();renderMusic()};
$('#plFiles').onchange=async e=>{const files=[...e.target.files];e.target.value='';let fail=0;const base=P.tracks.reduce((m,t)=>Math.max(m,t.order),0)+1;
  for(let i=0;i<files.length;i++){const f=files[i],o={id:'t'+Date.now().toString(36)+i+Math.random().toString(36).slice(2,6),name:f.name.replace(/\.[^.]+$/,''),blob:f,order:base+i};if(!DB.db||!(await DB.put('tracks',o)))fail++;P.tracks.push(o)}
  renderMusic();if(fail)alert(fail+' song(s) could not be saved and will be gone after a reload.')};
$('#startBtn').onclick=()=>{initAudio();started=true;$('#start').classList.add('gone');keepAwake();preloadAll()};

renderBoard();renderSetup();renderMusic();renderHold();
DB.open().then(plLoad);

/* ---------- Install and offline ---------- */
let installEvt=null;
const isStandalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone;
function renderInstall(){const show=!!installEvt&&!isStandalone();$('#installBtn').hidden=!show;$('#installBtn2').hidden=!show}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEvt=e;renderInstall()});
window.addEventListener('appinstalled',()=>{installEvt=null;renderInstall()});
async function doInstall(){if(!installEvt)return;installEvt.prompt();try{await installEvt.userChoice}catch(e){}installEvt=null;renderInstall()}
$('#installBtn').onclick=doInstall;$('#installBtn2').onclick=doInstall;
async function renderOffline(){const el=$('#offlineState');if(!el)return;let t='';
  if(!('serviceWorker' in navigator)||!location.protocol.startsWith('http'))t='Offline mode needs the page served from GitHub Pages (https).';
  else{const reg=await navigator.serviceWorker.getRegistration();t=reg&&reg.active?'✓ Ready offline. Open it once with internet after any update.':'Preparing offline mode… open the page once more with internet.'}
  try{if(navigator.storage&&navigator.storage.persisted&&await navigator.storage.persisted())t+=' Your sounds and songs are protected from automatic clean-up.'}catch(e){}
  el.textContent=t}
if('serviceWorker' in navigator&&location.protocol.startsWith('http')){window.addEventListener('load',()=>{navigator.serviceWorker.register('sw.js').then(()=>navigator.serviceWorker.ready).then(renderOffline).catch(renderOffline)})}
try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().then(renderOffline)}catch(e){}
renderOffline();
