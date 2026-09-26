// node stills.js <beats,comma> <sheetName> [mb]  — renders stills (optionally motion-blurred) + contact sheet
const E=require('./engine');const {execSync}=require('child_process');const fs=require('fs');
(async()=>{
  const beats=process.argv[2].split(',').map(Number);const name=process.argv[3]||'sheet';const mb=process.argv[4]==='mb';
  fs.mkdirSync(__dirname+'/work/stills',{recursive:true});
  await E.load();const c=new E.Canvas(E.W,E.H),x=c.getContext('2d');const files=[];
  for(const b of beats){const t0=Date.now();const f=`${__dirname}/work/stills/${E.V?'v':''}t${b.toFixed(2)}.jpg`;
    if(mb){const fi=Math.round(b*30);const acc=new Uint16Array(E.W*E.H*4);const ss=E.samples(fi);
      for(const s of ss){E.drawFrame(x,s,fi);const buf=await c.toBuffer('raw');for(let i=0;i<buf.length;i++)acc[i]+=buf[i];}
      const out=new E.Canvas(E.W,E.H),ox=out.getContext('2d');const d=ox.createImageData(E.W,E.H);for(let i=0;i<acc.length;i++)d.data[i]=acc[i]/ss.length;ox.putImageData(d,0,0);await out.toFile(f,{quality:.85});}
    else{E.drawFrame(x,b,Math.round(b*30));await c.toFile(f,{quality:.85});}
    files.push(f);console.log('b',b,Date.now()-t0,'ms');}
  execSync(`python3 /projects/sandbox/tools/sheet.py ${__dirname}/work/${name}.jpg ${files.join(' ')}`);console.log('sheet',name);
})().catch(e=>{console.error(e);process.exit(1)});
