// node render.js <start> <end> <segIndex>  — renders frames [start,end) with 10-subframe motion blur, pipes to FFmpeg.
// Frame 0 is replaced by the poster frame (posterBeat) so every platform's thumbnail is a settled shot.
const E=require('./engine');const {spawn}=require('child_process');const fs=require('fs');
const [start,end,idx]=process.argv.slice(2).map(Number);
(async()=>{
  await E.load();const {W,H,TL}=E;const c=new E.Canvas(W,H),x=c.getContext('2d');
  const segDir=__dirname+(E.V?'/work/seg-v/':'/work/seg/');fs.mkdirSync(segDir,{recursive:true});
  const ff=spawn('ffmpeg',['-y','-hide_banner','-loglevel','error','-f','rawvideo','-pix_fmt','rgba','-s',`${W}x${H}`,'-r',String(TL.fps),'-i','-',
    '-c:v','libx264','-preset','medium','-crf','16','-pix_fmt','yuv420p','-g','60','-r',String(TL.fps),segDir+`seg${String(idx).padStart(2,'0')}.mp4`],{stdio:['pipe','inherit','inherit']});
  const acc=new Uint16Array(W*H*4);const out=Buffer.alloc(W*H*4);
  const fpb=TL.fps/(TL.bpm/60);
  const t0=Date.now();
  for(let f=start;f<end;f++){
    acc.fill(0);
    // poster: sample around posterBeat instead of beat 0
    const fi=f===0?Math.round(TL.posterBeat*fpb):f;
    const ss=E.samples(fi);
    for(const s of ss){E.drawFrame(x,s,fi);const buf=await c.toBuffer('raw');for(let i=0;i<buf.length;i++)acc[i]+=buf[i];}
    const n=ss.length;for(let i=0;i<acc.length;i++)out[i]=(acc[i]+(n>>1))/n|0;
    if(f===0)fs.writeFileSync(__dirname+(E.V?'/work/poster-v.rgba':'/work/poster.rgba'),out);
    if(!ff.stdin.write(out))await new Promise(r=>ff.stdin.once('drain',r));
    if((f-start)%30===0)console.log(`seg${idx} frame ${f} (${f-start+1}/${end-start}) ${((Date.now()-t0)/(f-start+1)/1000).toFixed(2)}s/frame`);
  }
  ff.stdin.end();await new Promise(r=>ff.on('close',r));console.log(`seg${idx} done in ${((Date.now()-t0)/1000).toFixed(0)}s`);
})().catch(e=>{console.error(e);process.exit(1)});
