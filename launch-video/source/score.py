# Original score + UI sound design, generated from the SAME beat timeline as the picture (timeline.json).
import json, wave, numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
TL=json.load(open(__file__.rsplit('/',1)[0]+'/timeline.json'))
BPM=TL['bpm']; SPB=60/BPM; S={k:[a*SPB,b*SPB] for k,(a,b) in TL['scenes'].items()}
C=TL['cues']; sec=lambda b: b*SPB
SR=48000; DUR=TL['beats']*SPB; N=int(SR*DUR)
rng=np.random.default_rng(21)
mus=np.zeros((2,N)); pb=np.zeros((2,N)); sfx=np.zeros((2,N))
mtof=lambda m: 440*2**((m-69)/12)
tt=lambda d: np.arange(int(d*SR))/SR
def filt(x,kind,f,order=2): return sosfilt(butter(order,np.array(np.atleast_1d(f))/(SR/2),btype=kind,output='sos'),x)
def put(bus,x,t0,g=1.0,pan=0.0,width=0.0):
    i=int(t0*SR)
    if i>=N: return
    j=min(N,i+len(x)); x=x[:j-i]*g; l=np.sqrt((1-pan)/2); r=np.sqrt((1+pan)/2)
    bus[0,i:j]+=x*l; d=int(width*0.012*SR)
    bus[1,i:j]+=(np.concatenate([np.zeros(d),x])[:len(x)] if d else x)*r
def adsr(n,a,d,s,r,total):
    t=np.arange(n)/SR; e=np.where(t<a,t/max(a,1e-4),1.0); e=np.where((t>=a)&(t<a+d),1-(1-s)*(t-a)/d,e); e=np.where(t>=a+d,s,e)
    return np.where(t>total-r,e*np.clip(1-(t-(total-r))/r,0,1),e)
def saw(f,t,det=0.0): ph=f*(1+det)*t; return 2*(ph-np.floor(ph+0.5))
def supersaw(f,t,n=5,spread=0.012): return sum(saw(f,t,(k-(n-1)/2)*spread/(n-1)*2) for k in range(n))/n
def sub(f=45,d=0.5,dec=0.18): x=tt(d); fr=f+60*np.exp(-x/0.03); return np.sin(2*np.pi*np.cumsum(fr)/SR)*np.exp(-x/dec)
def bell(m,d=2.5):
    x=tt(d); f=mtof(m); y=np.sin(2*np.pi*f*x)+0.35*np.sin(2*np.pi*2*f*x)*np.exp(-x/0.4)+0.12*np.sin(2*np.pi*3.01*f*x)*np.exp(-x/0.15)
    return y*np.minimum(1,x/0.004)*np.exp(-x/0.9)
def impact(): x=tt(1.6); return sub(38,1.6,0.45)+0.15*filt(rng.standard_normal(len(x)),'high',3000)*np.exp(-x/0.25)
def riser(d,f0=300,f1=7000):
    x=tt(d); n=rng.standard_normal(len(x)); out=np.zeros_like(n); st=int(0.05*SR)
    for i in range(0,len(n),st):
        fc=f0*(f1/f0)**(i/len(n)); out[i:i+st]=filt(n[i:i+st+2000],'band',[fc*0.7,min(fc*1.4,20000)])[:len(out[i:i+st])]
    return out*np.linspace(0,1,len(x))**2
prog=[[57,60,64,71],[53,57,60,67],[48,52,55,62],[55,59,62,69]]; bassn=[33,29,36,31]
chord=lambda t: int(t//(4*SPB))%4   # one chord per bar (4 beats)

# ---- HOOK: low drone + muffled scrolling-source ticks, cut to silence before the reveal
cut=sec(TL['scenes']['hook'][1]-0.4); t=tt(cut)
put(pb,(np.sin(2*np.pi*55*t)+0.5*filt(saw(55,t,.003)+saw(55,t,-.004),'low',300))*np.minimum(1,t/0.8),0,0.22)
put(pb,filt(rng.standard_normal(len(t)),'band',[400,2200])*np.linspace(0.05,0.35,len(t)),0,0.09,0,1)
def tick(): x=tt(0.03); return filt(rng.standard_normal(len(x)),'band',[1500,5000])*np.exp(-x/0.006)
tk=0.0
while tk<cut-0.05: put(pb,tick(),tk,rng.uniform(0.05,0.12),rng.uniform(-.7,.7)); tk+=rng.uniform(0.03,0.09)
for bb in [2,3,4,5]: put(mus,sub(),sec(bb),0.3)
put(mus,bell(81),sec(C['hookText']),0.08,0,1)

# ---- pads from reveal to end
def pad(ch,d): x=tt(d); y=filt(sum(supersaw(mtof(m),x,5,0.01) for m in ch)/len(ch),'low',1800); return y*adsr(len(x),0.35,0.3,0.85,0.5,d)
bar=4*SPB; t0=S['reveal'][0]
while t0<S['end'][0]:
    d=min(bar+0.08,S['end'][0]-t0+0.4); lvl=0.10 if t0<S['browse'][0] else (0.07 if t0<S['any'][0] else (0.10 if t0<S['private'][0] else 0.11))
    put(mus,pad(prog[chord(t0)],d),t0,lvl,0,1); t0+=bar
for ib in C['impacts']: put(mus,impact(),sec(ib),0.42)
put(mus,bell(88,3.0),sec(TL['scenes']['reveal'][0])+0.05,0.07,0,1)
put(mus,riser(1.0),S['browse'][0]-1.0,0.18,0,1)

# ---- groove: browse → end of export; build into "any"; peak on "any"; drums out for private/cta
def kick():
    x=tt(0.4); f=48+110*np.exp(-x/0.035); y=np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-x/0.22)
    return np.tanh(1.6*(y+filt(rng.standard_normal(len(x)),'high',2500)*np.exp(-x/0.004)*0.3))
def hat(o=False): x=tt(0.25 if o else 0.05); return filt(rng.standard_normal(len(x)),'high',7000)*np.exp(-x/(0.07 if o else 0.012))
def clap():
    x=tt(0.3); n=filt(rng.standard_normal(len(x)),'band',[900,4500])
    return n*(sum(np.exp(-np.maximum(0,x-d)/0.012)*(x>=d) for d in [0,0.011,0.022])+np.exp(-x/0.12)*0.6)
def bass(m,d): x=tt(d); f=mtof(m); return np.tanh(1.4*(np.sin(2*np.pi*f*x)+0.35*filt(saw(f,x),'low',700)))*adsr(len(x),0.005,0.1,0.8,0.06,d)
K,HC,HO,CL=kick(),hat(),hat(True),clap()
b0,b1=TL['scenes']['browse'][0],TL['scenes']['export'][1]; anyA,anyZ=TL['scenes']['any']
kicks=[]
for b in range(b0,b1):
    ts=sec(b); drop=anyA-2<=b<anyA
    if not drop: put(mus,K,ts,0.55); kicks.append(ts)
    put(mus,HC,ts+SPB/2,0.06 if not anyA<=b<anyZ else 0.08,0.3); put(mus,HC,ts,0.03,-0.3)
    if b>=TL['scenes']['click'][0] and b%2==1: put(mus,CL,ts,0.15 if not anyA<=b<anyZ else 0.2,0.05,0.5)
    if b>=TL['scenes']['conf'][0] and b%4==3: put(mus,HO,ts+SPB/2,0.05,0.4)
    m=bassn[chord(ts)]; put(mus,bass(m,0.22),ts+SPB/2,0.26)
    if b%4==0: put(mus,bass(m,0.2),ts,0.18)
t0=sec(anyA-4)
while t0<sec(anyA):
    fr=(t0-sec(anyA-4))/sec(4); put(mus,CL,t0,0.04+0.12*fr); t0+=SPB/2 if fr<.4 else (SPB/4 if fr<.75 else SPB/8)
put(mus,riser(sec(4),200,9000),sec(anyA-4),0.18,0,1)
def pluck(m,d=0.3,br=1800): x=tt(d); return filt(saw(mtof(m),x),'low',br)*np.exp(-x/0.12)
k=0; ts=S['browse'][0]
while ts<sec(anyA-2):
    ch=prog[chord(ts)]; put(mus,pluck(ch[[0,2,1,3][k%4]]+12,0.3,900+1500*(ts-S['browse'][0])/(sec(anyA)-S['browse'][0])),ts,0.045,0.35*np.sin(k*1.3),0.6); ts+=SPB/2; k+=1
def stab(ch,d=0.45): x=tt(d); return filt(sum(supersaw(mtof(m+12),x,7,0.018) for m in ch)/len(ch),'low',4200)*adsr(len(x),0.004,0.12,0.4,0.15,d)
for c_ in C['anyCuts']: put(mus,stab(prog[chord(sec(c_))]),sec(c_),0.10,0,1)
ts=S['any'][0];k=0
while ts<S['any'][1]: put(mus,pluck(prog[chord(ts)][k%4]+24,0.18,5000),ts,0.03,0.5*np.sin(k),0.5); ts+=SPB/4; k+=1
put(mus,pad([57,60,64,71],S['cta'][1]-S['private'][0]+0.3),S['private'][0],0.08,0,1)
def final_chord(d=3.0):
    x=tt(d); ch=[45,57,64,67,71,76]
    return sum(np.sin(2*np.pi*mtof(m)*x)+0.2*np.sin(2*np.pi*2*mtof(m)*x)*np.exp(-x/0.6) for m in ch)/len(ch)*np.minimum(1,x/0.01)*np.exp(-x/1.6)
put(mus,sub(40,2.0,0.6),S['end'][0],0.5); put(mus,final_chord(),S['end'][0],0.35,0,1); put(mus,bell(88,3.0),S['end'][0]+0.05,0.06,0,1)

# ---- SFX on UI cues
def mclick(): x=tt(0.06); return filt(rng.standard_normal(len(x)),'band',[2500,7000])*np.exp(-x/0.004)+np.sin(2*np.pi*1400*x)*np.exp(-x/0.006)*0.4
def confirm(m=76): x=tt(0.35); y=np.maximum(0,x-0.06); return np.sin(2*np.pi*mtof(m)*x)*np.exp(-x/0.09)+0.6*np.sin(2*np.pi*mtof(m+7)*y)*np.exp(-y/0.1)*(x>0.06)
def blip(m): x=tt(0.18); f=mtof(m)*(1+0.3*np.exp(-x/0.01)); return np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-x/0.05)
def whoosh(d=0.55): x=tt(d); return filt(rng.standard_normal(len(x)),'band',[500,5000])*np.sin(np.pi*x/d)**2
for b in C['clicks']: put(sfx,mclick(),sec(b),0.26,0.1)
for b,m in zip(C['badges'],[76,79,81]): put(sfx,blip(m),sec(b),0.10,0.3)
put(sfx,blip(84),sec(C['badgeDeep']),0.10,0.3); put(sfx,sub(42,0.9,0.3),sec(C['iconClick']),0.3)
put(sfx,whoosh(0.4),sec(C['popupOpen']),0.10,0,1)
for b,m in zip(C['rings'],[81,84,86,88,76]): put(sfx,bell(m,0.8),sec(b),0.045,0.2*np.sin(m))
put(sfx,bell(69,1.0),sec(C['lowRing']),0.05,-0.2)
for k in range(9): put(sfx,mclick(),sec(C['evidReveal'][0])+k*(sec(C['evidReveal'][1])-sec(C['evidReveal'][0]))/9,0.07,0.15)
put(sfx,confirm(76),sec(C['mdClick'])+0.08,0.06); put(sfx,confirm(81),sec(C['jsonClick'])+0.08,0.06)
put(sfx,bell(88,1.2),sec(C['localRing']),0.06,0,1)
for b in C['whooshes']: put(sfx,whoosh(),sec(b),0.11,0,1)
for b in C['anyCuts'][1:]: put(sfx,whoosh(0.3),sec(b)-0.12,0.08,0,1)
put(sfx,confirm(84),sec(C['addClick'])+0.08,0.06)

# ---- mix
def reverb(x,dec=1.8,wet=0.22):
    it=tt(dec); ir=rng.standard_normal((2,len(it)))*np.exp(-it/(dec/5)); ir=filt(ir,'low',6000); ir/=np.sqrt((ir**2).sum(axis=1,keepdims=True))
    return np.stack([fftconvolve(x[c],ir[c])[:N] for c in range(2)])*wet
sc=np.ones(N)
for ts in kicks:
    i=int(ts*SR); n=min(int(0.3*SR),N-i); sc[i:i+n]=np.minimum(sc[i:i+n],1-0.45*np.exp(-np.arange(n)/SR/0.09))
T=np.arange(N)/SR
secg=np.interp(T,[0,S['browse'][0]-.01,S['browse'][0],S['any'][0]-.01,S['any'][0],S['any'][1],S['any'][1]+.01,DUR],[1,1,.8,.8,1,1,.85,.85])
m2=mus*sc*secg
gate=np.clip((cut-T)/0.02,0,1)
mix=m2+reverb(m2,2.2,0.2)+(pb+reverb(pb,1.6,0.25))*gate*0.55+sfx*0.9+reverb(sfx,1.2,0.12)
mix*=np.clip((DUR-T)/1.2,0,1); mix=filt(mix,'high',28)
mix=mix/np.abs(mix).max()*0.95; mix=np.tanh(mix*1.25)/np.tanh(1.25)*0.86
w=wave.open(__file__.rsplit('/',1)[0]+'/work/score.wav','wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix.T*32767).astype('<i2').tobytes()); w.close()
print('ok',DUR,'s')
