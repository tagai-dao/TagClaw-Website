/** Original AIPRO instrumental. Render with Playwright + Chromium, then encode the WAV to AAC.
 * PLAYWRIGHT_MODULE=/path/to/playwright node scripts/render-island-music.cjs /tmp/aipro-garden.wav
 * No samples or melody from the reference track are used.
 */
const fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({channel:'chrome'});try{const page=await browser.newPage();const samples=await page.evaluate(async()=>{
 const rate=22050,beat=60/72,bars=32,duration=bars*4*beat;
 const ctx=new OfflineAudioContext(2,Math.ceil(duration*rate),rate);
 const master=ctx.createGain();master.gain.setValueAtTime(0,0);master.gain.linearRampToValueAtTime(.7,1.8);master.gain.setValueAtTime(.7,duration-2);master.gain.linearRampToValueAtTime(0,duration);master.connect(ctx.destination);
 const echo=ctx.createDelay(2),feedback=ctx.createGain(),wet=ctx.createGain();echo.delayTime.value=beat*.75;feedback.gain.value=.25;wet.gain.value=.16;echo.connect(feedback);feedback.connect(echo);echo.connect(wet);wet.connect(master);
 const hz=n=>440*2**((n-69)/12);
 function note(n,time,len,amp,type='sine',pan=0,delay=false){const osc=ctx.createOscillator(),gain=ctx.createGain(),p=ctx.createStereoPanner();osc.type=type;osc.frequency.value=hz(n);p.pan.value=pan;gain.gain.setValueAtTime(.00001,time);gain.gain.exponentialRampToValueAtTime(amp,time+.015);gain.gain.exponentialRampToValueAtTime(.00001,time+len);osc.connect(gain);gain.connect(p);p.connect(master);if(delay)p.connect(echo);osc.start(time);osc.stop(time+len+.02);}
 function pad(notes,time,len){notes.forEach((n,i)=>{const osc=ctx.createOscillator(),g=ctx.createGain(),filter=ctx.createBiquadFilter(),pan=ctx.createStereoPanner();osc.type='triangle';osc.frequency.value=hz(n);osc.detune.value=(i-1.5)*3;filter.type='lowpass';filter.frequency.value=650;pan.pan.value=(i-1.5)*.28;g.gain.setValueAtTime(0,time);g.gain.linearRampToValueAtTime(.023,time+.45);g.gain.setValueAtTime(.023,time+len-.8);g.gain.linearRampToValueAtTime(0,time+len);osc.connect(filter);filter.connect(g);g.connect(pan);pan.connect(master);osc.start(time);osc.stop(time+len);});}
 const noise=ctx.createBuffer(1,rate,rate);let seed=7;const nb=noise.getChannelData(0);for(let i=0;i<nb.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;nb[i]=seed/2147483648-1;}
 function percussion(time,amp,len,cutoff){const s=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();s.buffer=noise;f.type='highpass';f.frequency.value=cutoff;g.gain.setValueAtTime(amp,time);g.gain.exponentialRampToValueAtTime(.00001,time+len);s.connect(f);f.connect(g);g.connect(master);s.start(time);s.stop(time+len);}
 function kick(time){const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.setValueAtTime(95,time);o.frequency.exponentialRampToValueAtTime(42,time+.18);g.gain.setValueAtTime(.095,time);g.gain.exponentialRampToValueAtTime(.00001,time+.28);o.connect(g);g.connect(master);o.start(time);o.stop(time+.3);}
 const chords=[[53,60,64,69],[55,62,65,69],[52,59,62,67],[57,60,64,67],[50,57,60,65],[55,59,62,65],[48,55,59,64],[48,55,60,64]];
 const motifs=[[76,79,81,79,76,72],[74,77,81,77,74,71],[71,74,79,76,74,71],[72,76,79,81,79,76],[77,81,84,81,77,74],[74,79,77,74,71,67],[76,79,83,79,76,72],[74,76,79,76,72,0]];
 for(let bar=0;bar<bars;bar++){const start=bar*4*beat,chord=chords[bar%8];pad(chord,start,4*beat);note(chord[0]-12,start,1.8*beat,.07);note(chord[0]-12,start+2.5*beat,beat,.047);
  [0,2.5].forEach(b=>kick(start+b*beat));[1,3].forEach(b=>{percussion(start+b*beat,.022,.13,1800);note(38,start+b*beat,.1,.009,'triangle');});
  for(let eighth=0;eighth<8;eighth++)percussion(start+(eighth*.5+(eighth%2?.035:0))*beat,eighth%2?.008:.012,.045,6500);
  const positions=[0,.75,1.5,2.25,3,3.5];motifs[bar%8].forEach((n,i)=>{if(n&&(bar%8!==7||i<4)){const t=start+positions[i]*beat;note(n,t,.85*beat,.025,'sine',i%2?.2:-.2,true);note(n+12,t,.4*beat,.005,'sine',-.15,true);}});
  if(bar>=8)chord.forEach((n,i)=>note(n+12,start+(i+.5)*beat,.55*beat,.008,'triangle',i%2?.35:-.35,true));
 }
 const rendered=await ctx.startRendering();const frames=rendered.length,out=new Uint8Array(44+frames*4),view=new DataView(out.buffer);const str=(offset,s)=>{for(let i=0;i<s.length;i++)out[offset+i]=s.charCodeAt(i)};str(0,'RIFF');view.setUint32(4,out.length-8,true);str(8,'WAVEfmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,2,true);view.setUint32(24,rate,true);view.setUint32(28,rate*4,true);view.setUint16(32,4,true);view.setUint16(34,16,true);str(36,'data');view.setUint32(40,frames*4,true);let peak=0;for(let i=0;i<frames;i++)for(let c=0;c<2;c++){const v=rendered.getChannelData(c)[i];peak=Math.max(peak,Math.abs(v));view.setInt16(44+(i*2+c)*2,Math.round(Math.max(-1,Math.min(1,v))*32767),true)}let binary='';for(let i=0;i<out.length;i+=16384)binary+=String.fromCharCode(...out.subarray(i,i+16384));return{base64:btoa(binary),peak,duration};
 });fs.writeFileSync(process.argv[2]||'/tmp/aipro-garden.wav',Buffer.from(samples.base64,'base64'));console.log({duration:samples.duration,peak:samples.peak});}finally{await browser.close()}})();
