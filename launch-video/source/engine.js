// WhatStack launch film — beat-timed animation engine on Skia (skia-canvas).
// Every element is a pure function of b (time in beats). timeline.json drives picture and score.
// FMT=vertical renders 1080×1920; default 1920×1080.
const {Canvas,FontLibrary,loadImage,Path2D}=require('/projects/sandbox/tools/node_modules/skia-canvas');
const fs=require('fs');
const ROOT=__dirname+'/',CAP=ROOT+'cap/',ICONS='/projects/sandbox/whatstack/icons/';
const TL=JSON.parse(fs.readFileSync(ROOT+'timeline.json'));const S=TL.scenes,C=TL.cues;
const META=JSON.parse(fs.readFileSync(CAP+'meta.json'));
const V=process.env.FMT==='vertical';
const W=V?1080:1920,H=V?1920:1080,CX=W/2,CY=H/2;const pick=(h,v)=>V?v:h;
FontLibrary.use('Inter',[ROOT+'fonts/Inter.ttf']);FontLibrary.use('JBMono',[ROOT+'fonts/JetBrainsMono.ttf']);

// ---------- math
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x)),seg=(t,a,b)=>clamp((t-a)/(b-a)),lerp=(a,b,x)=>a+(b-a)*x;
const eo=x=>1-Math.pow(1-x,3),eo5=x=>1-Math.pow(1-x,5),eio=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;
const eback=x=>{const c=1.4;return 1+(c+1)*Math.pow(x-1,3)+c*Math.pow(x-1,2)};
const inS=(b,[a,z])=>b>=a&&b<z;const D2R=Math.PI/180;
function rng(seed){let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;}}
function rot([x,y,z],rx,ry,rz){let c=Math.cos(rz*D2R),s=Math.sin(rz*D2R);[x,y]=[x*c-y*s,x*s+y*c];
  c=Math.cos(ry*D2R);s=Math.sin(ry*D2R);[x,z]=[x*c+z*s,-x*s+z*c];c=Math.cos(rx*D2R);s=Math.sin(rx*D2R);[y,z]=[y*c-z*s,y*s+z*c];return [x,y,z];}
const PERS=2400;
function project([X,Y,Z]){const k=PERS/(PERS-Z);return [CX+(X-CX)*k,CY+(Y-CY)*k,k];}
function planePt(cam,u,v){const s=cam.s??1;const p=rot([(u-cam.fx)*s,(v-cam.fy)*s,0],cam.rx||0,cam.ry||0,cam.rz||0);return project([(cam.cx??CX)+p[0],(cam.cy??CY)+p[1],p[2]]);}
function camLerp(a,b,x){const o={};for(const k in a)o[k]=lerp(a[k],b[k]??a[k],x);return o;}

// ---------- brand
const TEAL='#2dd4bf',INDIGO='#6366f1',VIOLET='#c084fc',BLUE='#3b82f6',BADGE='#2563eb';
const BG='#0c0f14';
function grad(x,x0,x1){const g=x.createLinearGradient(x0,0,x1,0);g.addColorStop(0,TEAL);g.addColorStop(.5,'#818cf8');g.addColorStop(1,VIOLET);return g;}

// ---------- assets
const A={};const SITES=['stripe','notion','nextjs','netflix','react','vuejs','airbnb','github'];
async function load(){
  for(const s of SITES){A['page-'+s]=await loadImage(CAP+`page-${s}.jpg`);A['pop-'+s]=await loadImage(CAP+`pop-${s}.png`);}
  A['pop-stripe-open']=await loadImage(CAP+'pop-stripe-open.png');
  A.store=await loadImage(CAP+'store.jpg');A.logo=await loadImage(ICONS+'logo-512.png');A.icon=await loadImage(ICONS+'icon128.png');
  // hook: the real HTML source of stripe.com, set in mono and pre-blurred
  const html=fs.readFileSync(CAP+'src-stripe.html','utf8').slice(0,60000).replace(/\s+/g,' ');
  const cols=150,rows=180,lines=[];for(let i=0;i<rows;i++)lines.push(html.slice(i*cols,(i+1)*cols));
  const sc=new Canvas(2600,rows*30),sx=sc.getContext('2d');sx.fillStyle='#0a0d12';sx.fillRect(0,0,2600,rows*30);
  sx.font='400 17px JBMono';lines.forEach((l,i)=>{let px=30;for(const tok of l.split(/(<[^>]*>)/)){if(!tok)continue;
      sx.fillStyle=tok.startsWith('<')?(i%7===0?'#7dd3fc':'#93a4bd'):'#566377';sx.fillText(tok,px,24+i*30);px+=sx.measureText(tok).width;}});
  const bl=new Canvas(1300,rows*15),bx=bl.getContext('2d');bx.filter='blur(1.1px)';bx.drawImage(sc,0,0,1300,rows*15);A.src=bl;
  A.grain=[];for(let g=0;g<6;g++){const c=new Canvas(256,256),x=c.getContext('2d');const d=x.createImageData(256,256);const r=rng(99+g);
    for(let i=0;i<d.data.length;i+=4){const v=r()*255;d.data[i]=d.data[i+1]=d.data[i+2]=v;d.data[i+3]=255;}x.putImageData(d,0,0);A.grain.push(c);}
  A.EXP=META.stripe.popup.exports;
}

// ---------- primitives
function rr(x,u,v,w,h,r){x.beginPath();x.moveTo(u+r,v);x.arcTo(u+w,v,u+w,v+h,r);x.arcTo(u+w,v+h,u,v+h,r);x.arcTo(u,v+h,u,v,r);x.arcTo(u,v,u+w,v,r);x.closePath();}
function quad(cam,ox,oy,w,h){return [planePt(cam,ox,oy),planePt(cam,ox+w,oy),planePt(cam,ox+w,oy+h),planePt(cam,ox,oy+h)];}
function plane(x,cam,img,{w=1440,h=952,alpha=1,radius=14,shadow=true,overlay=null,src=null}={}){
  if(alpha<=0.001)return;const q=quad(cam,0,0,w,h);x.save();x.globalAlpha*=alpha;
  if(shadow){x.save();x.shadowColor='rgba(0,0,0,0.7)';x.shadowBlur=80;x.shadowOffsetY=40;x.fillStyle='#05070b';x.beginPath();x.moveTo(q[0][0],q[0][1]);for(const p of q.slice(1))x.lineTo(p[0],p[1]);x.closePath();x.fill();x.restore();}
  const m=x.createProjection(q.flatMap(p=>[p[0],p[1]]),[0,0,w,h]);x.setTransform(m);rr(x,0,0,w,h,radius);x.clip();x.imageSmoothingQuality='high';
  if(img){if(src)x.drawImage(img,...src,0,0,w,h);else x.drawImage(img,0,0,w,h);}
  if(overlay)overlay(x);x.restore();
  x.save();x.globalAlpha*=alpha*.6;x.strokeStyle='rgba(255,255,255,0.09)';x.lineWidth=1;x.beginPath();x.moveTo(q[0][0],q[0][1]);for(const p of q.slice(1))x.lineTo(p[0],p[1]);x.closePath();x.stroke();x.restore();}
const MAXW=W-120;
function line(x,b,parts,cx,y,{size=96,weight=800,align='center',out=null,color='#f5f7fb',track=-0.04,font='Inter'}={}){
  let ws,sp,total;const measure=()=>{x.font=`${weight} ${size}px ${font}`;x.letterSpacing=`${track*size}px`;ws=parts.map(p=>x.measureText(p.s).width);sp=x.measureText(' ').width;total=ws.reduce((a,c)=>a+c,0)+sp*(parts.length-1);};
  measure();const lim=align==='center'?MAXW:W-cx-60;if(total>lim){size*=lim/total;measure();}
  let px=align==='center'?cx-total/2:cx;const q=out?eio(seg(b,out[0],out[1])):0;
  parts.forEach((p,i)=>{const k=eo5(seg(b,p.at,p.at+1.1));const a=clamp(seg(b,p.at,p.at+.6))*(1-q);
    if(a>0.002){x.save();x.globalAlpha*=a;const bl=(1-k)*12;if(bl>.3)x.filter=`blur(${bl.toFixed(2)}px)`;x.fillStyle=p.g?grad(x,px,px+ws[i]):(p.c||color);x.textAlign='left';x.fillText(p.s,px,y+(1-k)*36-q*16);x.restore();}
    px+=ws[i]+sp;});}
const CURSOR=new Path2D('M4 2l16 9.5-7 1.6-3.6 6.6z');
function cursorPath(path,b){let px=path[0][1],py=path[0][2];
  for(let i=0;i<path.length-1;i++){const [ta,xa,ya]=path[i],[tb,xb,yb]=path[i+1];if(b>=ta&&b<=tb){const k=eio(seg(b,ta,tb));px=lerp(xa,xb,k);py=lerp(ya,yb,k);}if(b>tb){px=xb;py=yb;}}
  let press=0,rip=-1;for(const p of path)if(p[3]==='c'){press=Math.max(press,seg(b,p[0]-.12,p[0])-seg(b,p[0],p[0]+.25));if(b>=p[0]&&b<p[0]+1)rip=seg(b,p[0],p[0]+1);}
  return {px,py,press,rip,a:clamp(seg(b,path[0][0],path[0][0]+.4))*(1-seg(b,path[path.length-1][0],path[path.length-1][0]+.4))};}
function drawCursor(x,sx,sy,{press=0,rip=-1,a=1},scale=1.4){if(a<=0)return;
  if(rip>=0){x.save();x.globalAlpha*=(1-rip)*.9*a;x.strokeStyle='rgba(165,180,252,1)';x.lineWidth=2.5;x.beginPath();x.arc(sx,sy,12+rip*32,0,7);x.stroke();x.restore();}
  x.save();x.globalAlpha*=a;x.translate(sx-5,sy-4);const s=scale*(1-.16*press);x.scale(s,s);x.shadowColor='rgba(0,0,0,.55)';x.shadowBlur=8;x.shadowOffsetY=3;x.fillStyle='#fff';x.fill(CURSOR);
  x.shadowColor='transparent';x.strokeStyle='#05070b';x.lineWidth=1.3;x.lineJoin='round';x.stroke(CURSOR);x.restore();}
function band(x,h,stop=.82,sa=1){const g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,`rgba(12,15,20,1)`);g.addColorStop(stop,`rgba(12,15,20,${sa})`);g.addColorStop(1,'rgba(12,15,20,0)');x.fillStyle=g;x.fillRect(0,0,W,h);}
function bandLeft(x,w){const g=x.createLinearGradient(0,0,w,0);g.addColorStop(0,'rgba(12,15,20,1)');g.addColorStop(.72,'rgba(12,15,20,1)');g.addColorStop(1,'rgba(12,15,20,0)');x.fillStyle=g;x.fillRect(0,0,w,H);}
function sceneAlpha(b,[a,z],fin=.5,fout=.5){if(b<a||b>=z)return 0;return Math.min(fin?eo(seg(b,a,a+fin)):1,fout?1-eio(seg(b,z-fout,z)):1);}
function ring(x,bx,col,e,pad=5,r=null){if(e<=0)return;const s=lerp(1.4,1,eo(e));x.save();x.globalAlpha*=clamp(e*1.5);const cx=bx.x+bx.w/2,cy=bx.y+bx.h/2,w=(bx.w+pad*2)*s,h=(bx.h+pad*2)*s;
  rr(x,cx-w/2,cy-h/2,w,h,r??h/2);x.shadowColor=col;x.shadowBlur=16;x.strokeStyle=col;x.lineWidth=2;x.stroke();x.restore();}

// ---------- the browser window (a simple generic frame; not Chrome's real UI) with the real extension icon + badge
const TB=52,PX=976,PY=58,PWID=360;const ICX=1290,ICY=26; // icon centre in window coords
const HOSTS={stripe:'stripe.com',notion:'notion.com',nextjs:'nextjs.org',netflix:'netflix.com',react:'react.dev',vuejs:'vuejs.org',airbnb:'airbnb.com',github:'github.com'};
function toolbar(x,site,badge,badgePop=1,iconPress=0){
  x.fillStyle='#1b1f27';x.fillRect(0,0,1440,TB);x.fillStyle='rgba(255,255,255,.06)';x.fillRect(0,TB-1,1440,1);
  x.strokeStyle='#8b93a3';x.lineWidth=2;x.lineCap='round';x.lineJoin='round';
  const arrow=(cx,d)=>{x.beginPath();x.moveTo(cx+6*d,ICY);x.lineTo(cx-6*d,ICY);x.moveTo(cx-1*d,ICY-5);x.lineTo(cx-6*d,ICY);x.lineTo(cx-1*d,ICY+5);x.stroke();};
  arrow(28,1);x.globalAlpha*=.45;arrow(62,-1);x.globalAlpha/=.45;x.beginPath();x.arc(96,ICY,6.5,-.2*Math.PI,1.55*Math.PI);x.stroke();
  rr(x,124,9,1100,34,17);x.fillStyle='#262b35';x.fill();
  x.strokeStyle='#8b93a3';x.lineWidth=1.6;rr(x,142,20,10,8,2);x.stroke();x.beginPath();x.arc(147,20,3.5,Math.PI,0);x.stroke();
  x.font='500 15px Inter';x.letterSpacing='0px';x.fillStyle='#e6e9ef';x.fillText(HOSTS[site]||site,166,31);
  // extension slot: the real WhatStack icon + blue badge
  if(iconPress>0){x.fillStyle=`rgba(255,255,255,${.12*iconPress})`;x.beginPath();x.arc(ICX,ICY,17,0,7);x.fill();}
  x.drawImage(A.icon,ICX-11,ICY-11,22,22);
  if(badge){const s=lerp(.3,1,eback(clamp(badgePop)));x.save();x.globalAlpha*=clamp(badgePop*3);x.translate(ICX+9,ICY+9);x.scale(s,s);
    x.font='700 10px Inter';const tw=Math.max(14,x.measureText(badge).width+8);rr(x,-tw/2,-7,tw,14,7);x.fillStyle=BADGE;x.fill();x.strokeStyle='#1b1f27';x.lineWidth=1.5;x.stroke();
    x.fillStyle='#fff';x.textAlign='center';x.fillText(badge,0,3.6);x.restore();}
  // generic menu dots
  x.fillStyle='#8b93a3';[0,1,2].forEach(i=>{x.beginPath();x.arc(1410,ICY-6+i*6,1.7,0,7);x.fill();});
}
function popupH(site,open=false){return open?A['pop-stripe-open'].height/3:A['pop-'+site].height/3;}
function drawPopup(x,site,k=1,{open=false,overlay=null}={}){ // popup anchored under the icon, opens from its top-right
  if(k<=0)return;const img=open?A['pop-stripe-open']:A['pop-'+site];const h=img.height/3;
  x.save();const e=eo5(clamp(k));x.globalAlpha*=clamp(k*2.2);x.translate(PX+PWID,PY);x.scale(lerp(.94,1,e),lerp(.94,1,e));x.translate(-(PX+PWID),-PY);
  x.save();x.shadowColor='rgba(0,0,0,.6)';x.shadowBlur=40;x.shadowOffsetY=18;rr(x,PX,PY,PWID,h,10);x.fillStyle=BG;x.fill();x.restore();
  x.save();rr(x,PX,PY,PWID,h,10);x.clip();x.drawImage(img,PX,PY,PWID,h);if(overlay)overlay(x);x.restore();
  x.strokeStyle='rgba(255,255,255,.10)';x.lineWidth=1;rr(x,PX+.5,PY+.5,PWID-1,h-1,10);x.stroke();x.restore();}
const P=(bx)=>({x:PX+bx.x,y:PY+bx.y,w:bx.w,h:bx.h}); // popup box -> window coords
function windowPlane(x,cam,site,{badge=null,badgePop=1,popup=0,open=false,popOverlay=null,iconPress=0,alpha=1,dim=0}={}){
  plane(x,cam,null,{w:1440,h:952,alpha,overlay:(p)=>{p.drawImage(A['page-'+site],0,TB,1440,900);if(dim>0){p.fillStyle=`rgba(12,15,20,${dim})`;p.fillRect(0,TB,1440,900);}toolbar(p,site,badge,badgePop,iconPress);drawPopup(p,site,popup,{open,overlay:popOverlay});}});}

// ---------- ambient
function ambient(x,b,level=1){const t=b*.5;
  const blob=(cx,cy,r,col,a)=>{const g=x.createRadialGradient(cx,cy,0,cx,cy,r);g.addColorStop(0,`rgba(${col},${a})`);g.addColorStop(1,`rgba(${col},0)`);x.fillStyle=g;x.fillRect(cx-r,cy-r,2*r,2*r);};
  blob(W*.12+Math.sin(t*.25)*90,H*.08+Math.cos(t*.2)*60,760,'45,212,191',.08*level);
  blob(W*.88+Math.cos(t*.22)*100,H*.95+Math.sin(t*.3)*60,880,'99,102,241',.13*level);
  blob(W*.9+Math.sin(t*.18)*60,H*.1,520,'192,132,252',.05*level);}
function finish(x,b,fi){const g=x.createRadialGradient(CX,CY-40,pick(720,640),CX,CY,1300);g.addColorStop(0,'rgba(12,15,20,0)');g.addColorStop(1,'rgba(12,15,20,.7)');x.fillStyle=g;x.fillRect(0,0,W,H);
  x.save();x.globalAlpha=.03;const p=x.createPattern(A.grain[fi%A.grain.length],'repeat');x.fillStyle=p;x.translate((fi*37)%256,(fi*91)%256);x.fillRect(-256,-256,W+512,H+512);x.restore();}

// ================= SCENES
function hook(x,b){const [a,z]=S.hook;if(!inS(b,[a,z]))return;x.save();
  const cut=z-.4;if(b<cut){const k=seg(b,0,cut);x.save();x.globalAlpha=lerp(.25,.75,eo(seg(b,0,1.5)));x.translate(CX,CY);x.rotate(-4*D2R);const zs=pick(1.0,1.5)+k*.08;x.scale(zs,zs);
    x.drawImage(A.src,-1300,-700-k*3200,2600,A.src.height*2);x.restore();
    const g=x.createRadialGradient(CX,CY,0,CX,CY,pick(900,800));g.addColorStop(0,'rgba(12,15,20,.9)');g.addColorStop(1,'rgba(12,15,20,.2)');x.fillStyle=g;x.fillRect(0,0,W,H);}
  const o=[cut-.3,cut];
  if(!V)line(x,b,[{s:"What’s this site",at:C.hookText},{s:'built with?',at:C.hookText+.5,g:1}],CX,CY+30,{size:112,out:o});
  else{line(x,b,[{s:"What’s this site",at:C.hookText}],CX,CY-30,{size:112,out:o});line(x,b,[{s:'built with?',at:C.hookText+.5,g:1}],CX,CY+100,{size:112,out:o});}
  x.restore();}

function reveal(x,b){const [a,z]=S.reveal;if(!inS(b,[a,z]))return;const sa=sceneAlpha(b,[a,z],.3,.5);x.save();x.globalAlpha=sa;
  const lk=eo5(seg(b,a,a+1.3));const ls=pick(170,220);const ly=pick(360,700);
  x.save();x.globalAlpha*=clamp(seg(b,a,a+.4));x.translate(CX,ly);x.scale(lerp(.86,1,lk),lerp(.86,1,lk));x.shadowColor='rgba(99,102,241,.55)';x.shadowBlur=60*lk;x.drawImage(A.logo,-ls/2,-ls/2,ls,ls);x.restore();
  // wordmark resolves from wide tracking + blur
  const k=eo5(seg(b,a+.35,a+1.8));const al=clamp(seg(b,a+.35,a+.9));const size=pick(132,150);
  x.save();x.globalAlpha*=al;x.font=`800 ${size}px Inter`;x.letterSpacing=`${lerp(.06,-.045,k)*size}px`;x.textAlign='center';if(k<1)x.filter=`blur(${((1-k)*14).toFixed(1)}px)`;
  x.fillStyle='#f5f7fb';x.fillText('WhatStack',CX,pick(620,1010));x.restore();
  line(x,b,[{s:'What’s under',at:a+1.2},{s:'this page?',at:a+1.2,g:1}],CX,pick(720,1120),{size:pick(52,62),weight:600,track:-0.02});
  x.restore();}

function browse(x,b){const [a,z]=S.browse;if(!inS(b,[a,z]))return;const sa=sceneAlpha(b,[a,z],.5,.4);x.save();x.globalAlpha=sa;
  const order=['nextjs','notion','stripe'];let i=0;C.sitePages.forEach((t,j)=>{if(b>=t)i=j;});const site=order[i];
  const since=b-C.sitePages[i];const kk=eo(seg(b,a,z));
  const slide=eo5(seg(since,0,.5));
  let cam=V?{fx:1000,fy:470,cx:540+(1-slide)*60,cy:1180,s:lerp(1.02,1.08,kk),rx:lerp(12,8,kk),ry:lerp(-10,-6,kk)}
           :{fx:720,fy:476,cx:960+(1-slide)*50,cy:620,s:lerp(.9,.95,kk),rx:lerp(14,9,kk),ry:lerp(-8,-4,kk)};
  const badge=META[site].light.badge;const bp=seg(b,C.badges[i],C.badges[i]+.5);
  windowPlane(x,cam,site,{badge:b>=C.badges[i]?badge:null,badgePop:bp,alpha:1});
  // spotlight ring on the badge when it lands
  const [bx,by]=planePt(cam,ICX+9,ICY+9);const e=seg(b,C.badges[i],C.badges[i]+1.2);
  if(e>0&&e<1){x.save();x.globalAlpha*=(1-e)*.9;x.strokeStyle='rgba(59,130,246,1)';x.lineWidth=2.5;x.beginPath();x.arc(bx,by,10+e*46,0,7);x.stroke();x.restore();}
  band(x,pick(240,560),.55,1);
  if(!V)line(x,b,[{s:'It reads the stack',at:a+.3},{s:'while you browse.',at:a+.3,g:1}],CX,150,{size:84});
  else{line(x,b,[{s:'It reads the stack',at:a+.3}],CX,330,{size:92});line(x,b,[{s:'while you browse.',at:a+.55,g:1}],CX,440,{size:92});}
  x.restore();}

function clickScene(x,b){const [a,z]=S.click;if(!inS(b,[a,z]))return;const sa=sceneAlpha(b,[a,z],.4,.5);x.save();x.globalAlpha=sa;
  const site='stripe';const pk=seg(b,C.popupOpen,C.popupOpen+.7);const hp=eio(seg(b,C.headlinePush,C.headlinePush+2));
  const hb=P(META.stripe.popup.headline);const hcx=hb.x+hb.w/2,hcy=hb.y+hb.h/2;
  let cam=V?{fx:1000,fy:470,cx:540,cy:1180,s:1.08,rx:8,ry:-6}:{fx:720,fy:476,cx:960,cy:620,s:.95,rx:9,ry:-4};
  cam=camLerp(cam,V?{fx:1156,fy:300,cx:540,cy:1150,s:1.75,rx:6,ry:-5}:{fx:1156,fy:320,cx:1240,cy:560,s:1.45,rx:7,ry:-6},eio(seg(b,a,C.iconClick+.3)));
  cam=camLerp(cam,V?{fx:hcx,fy:hcy+70,cx:540,cy:1260,s:2.75,rx:4,ry:-3}:{fx:hcx,fy:hcy+60,cx:1420,cy:560,s:2.55,rx:4,ry:-5},hp);
  const badge=b>=C.badgeDeep?META.stripe.deep.badge:META.stripe.light.badge;const bpop=b>=C.badgeDeep?seg(b,C.badgeDeep,C.badgeDeep+.5):1;
  const cp=cursorPath([[a+.3,pick(1100,1000),420],[C.iconClick-.12,ICX+2,ICY+3],[C.iconClick,ICX+2,ICY+3,'c'],[C.iconClick+.9,ICX+60,ICY+140]],b);
  windowPlane(x,cam,site,{badge,badgePop:bpop,popup:pk,iconPress:cp.press,dim:.78*eo(seg(b,C.popupOpen,C.popupOpen+1)),popOverlay:(p)=>{ring(p,{x:hb.x,y:hb.y,w:hb.w,h:hb.h},'rgba(129,140,248,1)',seg(b,C.headlinePush+1.2,C.headlinePush+2),3,12);}});
  const [sx,sy]=planePt(cam,cp.px,cp.py);drawCursor(x,sx,sy,cp,pick(1.4,1.7));
  if(!V){bandLeft(x,1000);line(x,b,[{s:'One click.',at:a+.8}],120,470,{size:92,align:'left'});line(x,b,[{s:'The whole',at:C.headlinePush+.2},{s:'stack.',at:C.headlinePush+.2,g:1}],120,582,{size:92,align:'left'});}
  else{band(x,600,.6,1);line(x,b,[{s:'One click.',at:a+.8}],CX,330,{size:100});line(x,b,[{s:'The whole',at:C.headlinePush+.2},{s:'stack.',at:C.headlinePush+.2,g:1}],CX,450,{size:100});}
  x.restore();}

function conf(x,b){const [a,z]=S.conf;if(!inS(b,[a,z]))return;const sa=sceneAlpha(b,[a,z],.4,.5);x.save();x.globalAlpha=sa;
  const gh=b>=C.githubCut;const site=gh?'github':'stripe';const pop=META[site].popup;
  if(!gh){const k=eo(seg(b,a,C.githubCut));const cam=V?{fx:1156,fy:lerp(420,440,k),cx:540,cy:1290,s:lerp(2.55,2.65,k),rx:5,ry:-4}:{fx:1156,fy:lerp(360,420,k),cx:1260,cy:560,s:lerp(1.75,1.85,k),rx:6,ry:-6};
    windowPlane(x,cam,site,{badge:META.stripe.deep.badge,popup:1,dim:.78,popOverlay:(p)=>{pop.hits.forEach((h,i)=>{const bd=h.badge;const med=/MEDIUM/.test(h.text);
      ring(p,{x:PX+bd.x,y:PY+bd.y,w:bd.w,h:bd.h},med?'#fbbf24':'#34d399',seg(b,C.rings[i],C.rings[i]+.6),4);});}});}
  else{const k=eo(seg(b,C.githubCut,z));const lw=P(pop.low);const cam=V?{fx:1156,fy:lw.y+40,cx:540,cy:1260,s:lerp(2.7,2.8,k),rx:5,ry:-4}:{fx:1156,fy:lw.y+40,cx:1260,cy:560,s:lerp(2.1,2.2,k),rx:6,ry:-6};
    windowPlane(x,cam,site,{badge:META.github.deep.badge,popup:1,dim:.78,popOverlay:(p)=>{const s=pop.sections.find(q=>/BUILD/i.test(q.title));
      ring(p,{x:PX+s.x,y:PY+s.y,w:s.w,h:s.h},'#94a3b8',seg(b,C.lowRing,C.lowRing+.6),3,10);}});}
  if(!V){bandLeft(x,1000);line(x,b,[{s:'Confidence,',at:a+.2}],120,480,{size:100,align:'left'});line(x,b,[{s:'not',at:a+.5},{s:'guesses.',at:a+.5,g:1}],120,600,{size:100,align:'left'});
    line(x,b,[{s:'High',at:C.rings[0],c:'#34d399'},{s:'·',at:C.rings[0],c:'#475569'},{s:'Medium',at:C.rings[4],c:'#fbbf24'},{s:'·',at:C.rings[4],c:'#475569'},{s:'Low',at:C.lowRing,c:'#94a3b8'}],124,690,{size:40,weight:600,align:'left',track:-0.01});}
  else{band(x,700,.86,1);line(x,b,[{s:'Confidence,',at:a+.2}],CX,320,{size:100});line(x,b,[{s:'not',at:a+.5},{s:'guesses.',at:a+.5,g:1}],CX,440,{size:100});
    line(x,b,[{s:'High',at:C.rings[0],c:'#34d399'},{s:'·',at:C.rings[0],c:'#475569'},{s:'Medium',at:C.rings[4],c:'#fbbf24'},{s:'·',at:C.rings[4],c:'#475569'},{s:'Low',at:C.lowRing,c:'#94a3b8'}],CX,530,{size:44,weight:600,track:-0.01});}
  x.restore();}

function evid(x,b){const [a,z]=S.evid;if(!inS(b,[a,z]))return;const sa=sceneAlpha(b,[a,z],.4,.5);x.save();x.globalAlpha=sa;
  const open=b>=C.rowClick+.05;const row=P(META.stripe.popup.hits[0]);const ex=META.stripe.popup.expanded;const ev=ex.evidence[0]?P(ex.evidence[0]):{x:row.x,y:row.y+38,w:338,h:150};
  const k=eio(seg(b,C.rowClick,C.rowClick+1.4));
  let cam=V?{fx:1156,fy:row.y+20,cx:540,cy:1180,s:2.7,rx:5,ry:-4}:{fx:1156,fy:row.y+20,cx:1260,cy:470,s:2.2,rx:6,ry:-6};
  cam=camLerp(cam,V?{fx:1156,fy:ev.y+ev.h/2-10,cx:540,cy:1300,s:2.75}:{fx:1156,fy:ev.y+ev.h/2-10,cx:1260,cy:560,s:2.25},k);
  const rev=eio(seg(b,C.evidReveal[0],C.evidReveal[1]));
  const cp=cursorPath([[a+.2,PX+300,row.y+170],[C.rowClick-.12,PX+120,row.y+19],[C.rowClick,PX+120,row.y+19,'c'],[C.rowClick+1,PX+250,row.y-40]],b);
  windowPlane(x,cam,'stripe',{badge:META.stripe.deep.badge,popup:1,open,dim:.78,popOverlay:(p)=>{if(!open)return;
    // evidence lines type in top-to-bottom (the list itself is the real expanded popup)
    const y0=ev.y+ev.h*rev;p.fillStyle=BG;p.fillRect(ev.x-6,y0,ev.w+12,ev.y+ev.h-y0+2);
    if(rev<1){const g=p.createLinearGradient(ev.x,0,ev.x+ev.w,0);g.addColorStop(0,'rgba(59,130,246,0)');g.addColorStop(.5,'rgba(96,165,250,.9)');g.addColorStop(1,'rgba(59,130,246,0)');p.fillStyle=g;p.fillRect(ev.x,y0-1,ev.w,2);}}});
  const [sx,sy]=planePt(cam,cp.px,cp.py);drawCursor(x,sx,sy,cp,pick(1.4,1.7));
  if(!V){bandLeft(x,1000);line(x,b,[{s:'See why',at:a+.2}],120,480,{size:100,align:'left'});line(x,b,[{s:'it matched.',at:a+.45,g:1}],120,600,{size:100,align:'left'});
    line(x,b,[{s:'Scripts, globals and DOM —',at:C.evidReveal[1]-.4}],124,690,{size:34,weight:500,align:'left',color:'#aab6c8',track:-0.01});
    line(x,b,[{s:'never marketing copy.',at:C.evidReveal[1]-.2}],124,738,{size:34,weight:500,align:'left',color:'#aab6c8',track:-0.01});}
  else{band(x,720,.86,1);line(x,b,[{s:'See why',at:a+.2}],CX,320,{size:100});line(x,b,[{s:'it matched.',at:a+.45,g:1}],CX,440,{size:100});
    line(x,b,[{s:'Scripts, globals and DOM —',at:C.evidReveal[1]-.4}],CX,535,{size:38,weight:500,color:'#aab6c8',track:-0.01});
    line(x,b,[{s:'never marketing copy.',at:C.evidReveal[1]-.2}],CX,588,{size:38,weight:500,color:'#aab6c8',track:-0.01});}
  x.restore();}

function any(x,b){const [a,z]=S.any;if(!inS(b,[a,z]))return;const sa=sceneAlpha(b,[a,z],0,.5);x.save();x.globalAlpha=sa;
  const order=['notion','nextjs','react','netflix','airbnb','vuejs'];let i=0;C.anyCuts.forEach((t,j)=>{if(b>=t)i=j;});const site=order[i];
  const since=b-C.anyCuts[i];const k=seg(since,0,1.333);const sgn=i%2?1:-1;
  const cam=V?{fx:1120,fy:340,cx:540+sgn*lerp(18,0,eo(k)),cy:1180,s:lerp(1.6,1.68,k),rx:7,ry:sgn*lerp(7,4,k)}
             :{fx:1060,fy:360,cx:1250+sgn*lerp(20,0,eo(k)),cy:600,s:lerp(1.2,1.26,k),rx:7,ry:sgn*lerp(8,5,k)};
  windowPlane(x,cam,site,{badge:META[site].deep.badge,popup:1,dim:.78});
  if(!V){bandLeft(x,1000);line(x,b,[{s:'Any site.',at:a+.15}],120,480,{size:100,align:'left'});line(x,b,[{s:'Instantly.',at:a+.5,g:1}],120,600,{size:100,align:'left'});
    // live site label (real host of the page on screen)
    line(x,b,[{s:HOSTS[site],at:C.anyCuts[i]}],124,690,{size:36,weight:600,align:'left',color:'#7dd3fc',track:0});}
  else{band(x,640,.62,1);line(x,b,[{s:'Any site.',at:a+.15}],CX,330,{size:104});line(x,b,[{s:'Instantly.',at:a+.5,g:1}],CX,450,{size:104});
    line(x,b,[{s:HOSTS[site],at:C.anyCuts[i]}],CX,540,{size:40,weight:600,color:'#7dd3fc',track:0});}
  x.restore();}

function codeCard(x,title,text,b,at,{cx,cy,w,hmax,maxLines,alpha=1,fs=21}){const k=eo5(seg(b,at,at+.8));if(k<=0)return;
  const lines=text.split('\n').slice(0,maxLines);const lh=fs*1.5;const h=Math.min(hmax,70+lines.length*lh+24);
  x.save();x.globalAlpha*=clamp(seg(b,at,at+.4))*alpha;x.translate(cx,cy+(1-k)*60);x.scale(lerp(.96,1,k),lerp(.96,1,k));
  x.save();x.shadowColor='rgba(0,0,0,.6)';x.shadowBlur=60;x.shadowOffsetY=30;rr(x,-w/2,-h/2,w,h,16);x.fillStyle='#0b0f16';x.fill();x.restore();
  rr(x,-w/2,-h/2,w,h,16);x.strokeStyle='#243041';x.lineWidth=1.2;x.stroke();
  x.fillStyle='#141a22';rr(x,-w/2+1,-h/2+1,w-2,50,15);x.fill();x.fillStyle='#243041';x.fillRect(-w/2,-h/2+50,w,1);
  x.font='600 18px Inter';x.letterSpacing='0px';x.fillStyle='#8b9bb0';x.fillText(title,-w/2+24,-h/2+32);
  x.font='600 16px Inter';x.fillStyle='#34d399';x.textAlign='right';x.fillText(title==='Markdown'?'Copied Markdown':'Copied JSON',w/2-24,-h/2+32);x.textAlign='left';
  x.save();rr(x,-w/2,-h/2+51,w,h-51,16);x.clip();x.font=`400 ${fs}px JBMono`;
  const shown=Math.floor(lerp(0,lines.length,eo(seg(b,at+.2,at+1.6))));
  lines.slice(0,shown).forEach((l,i)=>{const y=-h/2+70+fs+i*lh;let px=-w/2+24;
    const toks=title==='JSON'?l.split(/("[^"]*"\s*:|"[^"]*")/):l.split(/(\|)/);
    for(const t of toks){if(!t)continue;x.fillStyle=title==='JSON'?(/:\s*$/.test(t)?'#93c5fd':t.startsWith('"')?'#a7f3d0':'#cbd5e1'):(t==='|'?'#475569':/^\s*(##|\*\*)/.test(l)&&i<3?'#e8eef7':'#cbd5e1');x.fillText(t,px,y);px+=x.measureText(t).width;}});
  x.restore();x.restore();}
function exportScene(x,b){const [a,z]=S.export;if(!inS(b,[a,z]))return;const sa=sceneAlpha(b,[a,z],.4,.5);x.save();x.globalAlpha=sa;
  const bt=META.stripe.popup.buttons;const md=P(bt.MD),js=P(bt.JSON);const k=eo(seg(b,a,z));
  const cam=V?{fx:1156,fy:md.y-40,cx:540,cy:1660,s:lerp(2.0,2.08,k),rx:6,ry:-4}:{fx:1156,fy:md.y-120,cx:1450,cy:560,s:lerp(1.5,1.56,k),rx:6,ry:-8};
  const cp=cursorPath([[a+.2,PX+300,md.y-120],[C.mdClick-.12,md.x+md.w/2,md.y+md.h/2],[C.mdClick,md.x+md.w/2,md.y+md.h/2,'c'],[C.jsonClick-.12,js.x+js.w/2,js.y+js.h/2],[C.jsonClick,js.x+js.w/2,js.y+js.h/2,'c'],[z,js.x+js.w/2+30,js.y+60]],b);
  windowPlane(x,cam,'stripe',{badge:META.stripe.deep.badge,popup:1,dim:.78,popOverlay:(p)=>{ring(p,md,'#60a5fa',seg(b,C.mdClick,C.mdClick+.5)*(1-seg(b,C.jsonClick-.3,C.jsonClick)),3,8);ring(p,js,'#60a5fa',seg(b,C.jsonClick,C.jsonClick+.5),3,8);}});
  const [sx,sy]=planePt(cam,cp.px,cp.py);drawCursor(x,sx,sy,cp,pick(1.4,1.7));
  const mdOut=1-eio(seg(b,C.jsonClick-.2,C.jsonClick+.2));
  const card=V?{cx:540,cy:980,w:1020,hmax:800}:{cx:590,cy:600,w:980,hmax:760};
  if(b<C.jsonClick+.2)codeCard(x,'Markdown',A.EXP.md,b,C.mdClick+.05,{...card,maxLines:10,alpha:mdOut,fs:pick(22,24)});
  codeCard(x,'JSON',A.EXP.json,b,C.jsonClick+.05,{...card,maxLines:pick(17,18),fs:pick(21,23)});
  band(x,pick(230,440),.8,1);
  if(!V)line(x,b,[{s:'Copy as text,',at:a+.2},{s:'Markdown',at:a+.2,g:1},{s:'or',at:a+.2},{s:'JSON.',at:a+.2,g:1}],CX,140,{size:76});
  else{line(x,b,[{s:'Copy as text,',at:a+.2}],CX,250,{size:90});line(x,b,[{s:'Markdown',at:a+.4,g:1},{s:'or',at:a+.4},{s:'JSON.',at:a+.4,g:1}],CX,360,{size:90});}
  x.restore();}

function privateScene(x,b){const [a,z]=S.private;if(!inS(b,[a,z]))return;const sa=sceneAlpha(b,[a,z],.4,.4);x.save();x.globalAlpha=sa;
  const lo=P(META.stripe.popup.local);const k=eio(seg(b,a,a+1.6));
  let cam=V?{fx:1156,fy:lo.y-60,cx:540,cy:1300,s:2.2,rx:6,ry:-4}:{fx:1156,fy:lo.y-60,cx:1100,cy:640,s:1.6,rx:6,ry:-8};
  cam=camLerp(cam,V?{fx:lo.x+lo.w/2-70,fy:lo.y+lo.h/2-30,cx:540,cy:1150,s:3.0,rx:4,ry:-3}:{fx:lo.x+lo.w/2-80,fy:lo.y+lo.h/2,cx:1060,cy:700,s:3.0,rx:4,ry:-6},k);
  windowPlane(x,cam,'stripe',{badge:META.stripe.deep.badge,popup:1,dim:.78,popOverlay:(p)=>ring(p,lo,TEAL,seg(b,C.localRing,C.localRing+.6),3)});
  if(!V){band(x,380,.8,1);line(x,b,[{s:'Runs entirely on your',at:a+.3},{s:'device.',at:a+.3,g:1}],CX,170,{size:92});
    line(x,b,[{s:'49 KB · No account · Nothing uploaded',at:a+1.4}],CX,255,{size:36,weight:500,color:'#aab6c8',track:-0.01});}
  else{band(x,720,.86,1);line(x,b,[{s:'Runs entirely',at:a+.3}],CX,340,{size:100});line(x,b,[{s:'on your',at:a+.55},{s:'device.',at:a+.55,g:1}],CX,460,{size:100});
    line(x,b,[{s:'49 KB · No account · Nothing uploaded',at:a+1.4}],CX,560,{size:40,weight:500,color:'#aab6c8',track:-0.01});}
  x.restore();}

function cta(x,b){const [a,z]=S.cta;if(!inS(b,[a,z]))return;if(V)return ctaV(x,b);const sa=sceneAlpha(b,[a,z],.35,0);x.save();x.globalAlpha=sa;
  // real Chrome Web Store listing header (logged out), cropped to icon + name + "Add to Chrome"
  const st=META.store;const s3=3;const cropX=180,cropY=226,cropW=1120,cropH=100;const k=eo(seg(b,a,z));
  const cam=V?{fx:cropW/2,fy:cropH/2,cx:540,cy:1000,s:lerp(.88,.93,k),rx:6,ry:-5}
             :{fx:cropW/2,fy:cropH/2,cx:960,cy:560,s:lerp(1.45,1.55,k),rx:7,ry:-5};
  plane(x,cam,A.store,{w:cropW,h:cropH,radius:16,src:[cropX*s3,cropY*s3,cropW*s3,cropH*s3],overlay:(p)=>{const ax=st.add.x-cropX,ay=st.add.y-cropY;
    const pr=seg(b,C.addClick-.1,C.addClick)-seg(b,C.addClick,C.addClick+.25);if(pr>0){rr(p,ax,ay,st.add.w,st.add.h,20);p.fillStyle=`rgba(0,0,0,${.15*pr})`;p.fill();}
    ring(p,{x:ax,y:ay,w:st.add.w,h:st.add.h},'rgba(96,165,250,1)',seg(b,C.addClick-.5,C.addClick),4);}});
  const ax=st.add.x-cropX+st.add.w*.55,ay=st.add.y-cropY+st.add.h*.6;
  const cp=cursorPath([[a+.1,cropW*.5,cropH+120],[C.addClick-.1,ax,ay],[C.addClick,ax,ay,'c'],[z,ax,ay]],b);const [sx,sy]=planePt(cam,cp.px,cp.py);drawCursor(x,sx,sy,{...cp,a:clamp(seg(b,a+.1,a+.4))},pick(1.6,1.8));
  line(x,b,[{s:'Free on the',at:a+.1},{s:'Chrome Web Store',at:a+.1,g:1}],CX,pick(830,1300),{size:pick(60,64),weight:700,track:-0.03});
  x.restore();}

function ctaV(x,b){const [a,z]=S.cta;const sa=sceneAlpha(b,[a,z],.35,0);x.save();x.globalAlpha=sa;const st=META.store;const s3=3;const k=eo(seg(b,a,z));
  const n={x:180,y:236,w:420,h:80};plane(x,{fx:n.w/2,fy:n.h/2,cx:540,cy:lerp(880,870,k),s:2.1,rx:5,ry:-4},A.store,{w:n.w,h:n.h,radius:16,src:[n.x*s3,n.y*s3,n.w*s3,n.h*s3]});
  const bt={x:st.add.x-18,y:st.add.y-14,w:st.add.w+36,h:st.add.h+28};const cam={fx:bt.w/2,fy:bt.h/2,cx:540,cy:lerp(1110,1100,k),s:3.0,rx:5,ry:-4};
  plane(x,cam,A.store,{w:bt.w,h:bt.h,radius:14,src:[bt.x*s3,bt.y*s3,bt.w*s3,bt.h*s3],overlay:(p)=>{const pr=seg(b,C.addClick-.1,C.addClick)-seg(b,C.addClick,C.addClick+.25);
    if(pr>0){rr(p,18,14,st.add.w,st.add.h,20);p.fillStyle=`rgba(0,0,0,${.15*pr})`;p.fill();}ring(p,{x:18,y:14,w:st.add.w,h:st.add.h},'rgba(96,165,250,1)',seg(b,C.addClick-.5,C.addClick),4);}});
  const ax=18+st.add.w*.6,ay=14+st.add.h*.62;const cp=cursorPath([[a+.1,bt.w*.9,bt.h+50],[C.addClick-.1,ax,ay],[C.addClick,ax,ay,'c'],[z,ax,ay]],b);
  const [sx,sy]=planePt(cam,cp.px,cp.py);drawCursor(x,sx,sy,{...cp,a:clamp(seg(b,a+.1,a+.4))},1.9);
  line(x,b,[{s:'Free on the',at:a+.1}],CX,1360,{size:66,weight:700,track:-0.03});line(x,b,[{s:'Chrome Web Store',at:a+.25,g:1}],CX,1445,{size:66,weight:700,track:-0.03});
  x.restore();}
function end(x,b){const [a,z]=S.end;if(!inS(b,[a,z]))return;x.save();
  const lk=eo5(seg(b,a+.1,a+1.3));const ls=pick(150,210);const ly=pick(330,640);
  x.save();x.globalAlpha*=clamp(seg(b,a+.1,a+.5));x.translate(CX,ly);x.scale(lerp(.9,1,lk),lerp(.9,1,lk));x.shadowColor='rgba(99,102,241,.5)';x.shadowBlur=60;x.drawImage(A.logo,-ls/2,-ls/2,ls,ls);x.restore();
  const k=eo5(seg(b,a+.3,a+1.6));x.save();x.globalAlpha*=clamp(seg(b,a+.3,a+.8));const size=pick(120,140);x.font=`800 ${size}px Inter`;x.letterSpacing=`${lerp(.05,-.045,k)*size}px`;x.textAlign='center';
  if(k<1)x.filter=`blur(${((1-k)*12).toFixed(1)}px)`;x.fillStyle='#f5f7fb';x.fillText('WhatStack',CX,pick(570,930));x.restore();
  line(x,b,[{s:'What’s under',at:a+.8},{s:'this page?',at:a+.8,g:1}],CX,pick(665,1040),{size:pick(50,58),weight:600,track:-0.02});
  line(x,b,[{s:'Free on the Chrome Web Store',at:a+1.3}],CX,pick(770,1160),{size:pick(34,40),weight:600,color:'#7dd3fc',track:0});
  x.restore();}

// ================= frame
function drawFrame(x,b,fi){x.setTransform(1,0,0,1,0,0);x.globalAlpha=1;x.filter='none';x.fillStyle=BG;x.fillRect(0,0,W,H);
  ambient(x,b,b<S.reveal[0]?0:1);
  hook(x,b);reveal(x,b);browse(x,b);clickScene(x,b);conf(x,b);evid(x,b);any(x,b);exportScene(x,b);privateScene(x,b);cta(x,b);end(x,b);finish(x,b,fi);}
const CUTS=[S.reveal[0],...C.sitePages,C.githubCut,C.rowClick+.05,...C.anyCuts,S.cta[0],S.end[0],C.badgeDeep,...C.badges];
function samples(fi){const fr=1/(TL.fps/(TL.bpm/60));const bc=fi*fr;const sp=fr*TL.shutter;const out=[];
  for(let k=0;k<TL.subframes;k++){let b=bc+((k+.5)/TL.subframes-.5)*sp;for(const c of CUTS){if(bc<c&&b>=c)b=c-1e-4;if(bc>=c&&b<c)b=c;}out.push(Math.max(0,b));}return out;}
module.exports={load,drawFrame,samples,TL,W,H,V,Canvas};
