#!/usr/bin/env python3
"""Render an editorial demo from real browser captures and generated animation assets.
Requires Python + Pillow and ffmpeg. No browser state is fabricated.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math, subprocess, json, sys
ROOT=Path(__file__).resolve().parent
A=ROOT/'assets'; C=ROOT/'captures'; O=ROOT/'output'; O.mkdir(exist_ok=True)
VW,VH,FPS=1280,720,30
S=1.5;W,H=1920,1080
def px(value):return round(value*S)
BG=(8,11,20); INK='#eee9db'; GOLD='#ecc77e'; MUTED='#a4a5b0'
FONTS={}
def font(n,weight=500):
 k=(n,weight)
 if k not in FONTS:FONTS[k]=ImageFont.truetype(str(A/f'dm-sans-{weight}.ttf'),px(n))
 return FONTS[k]
class ScaledDraw:
 def __init__(self,im,mode=None):self.d=ImageDraw.Draw(im,mode)
 def box(self,coords):return tuple(px(v) for v in coords)
 def text(self,xy,*args,**kw):
  if 'spacing' in kw:kw['spacing']=px(kw['spacing'])
  return self.d.text(self.box(xy),*args,**kw)
 def textlength(self,*args,**kw):return self.d.textlength(*args,**kw)/S
 def rectangle(self,coords,**kw):
  if 'width' in kw:kw['width']=px(kw['width'])
  return self.d.rectangle(self.box(coords),**kw)
 def ellipse(self,coords,**kw):
  if 'width' in kw:kw['width']=px(kw['width'])
  return self.d.ellipse(self.box(coords),**kw)
 def rounded_rectangle(self,coords,radius=0,**kw):
  if 'width' in kw:kw['width']=px(kw['width'])
  return self.d.rounded_rectangle(self.box(coords),radius=px(radius),**kw)
def draw(im,mode=None):return ScaledDraw(im,mode)
def text(im,xy,s,n=24,color=INK,weight=500):draw(im).text(xy,s,font=font(n,weight),fill=color,spacing=5)
def lines(im,x,y,ss,n=54,step=64,color=INK):
 for j,s in enumerate(ss):text(im,(x,y+j*step),s,n,color,600)
def ease(v):v=max(0,min(1,v));return v*v*(3-2*v)
plate=Image.open(A/'night-plate.png').convert('RGB').resize((W,1280),Image.Resampling.LANCZOS).crop((0,98,W,1178))
dim=Image.blend(Image.new('RGB',(W,H),BG),plate,.20)
near_mark=Image.open(A/'near-mark.png').convert('RGBA').resize((px(24),px(24)),Image.Resampling.LANCZOS)
atlas=Image.open(A/'characters.png').convert('RGBA');cw,ch=atlas.width//2,atlas.height//2
sprites={}
for row in range(2):
 for col in range(2):
  im=atlas.crop((col*cw,row*ch,(col+1)*cw,(row+1)*ch));bbox=im.getchannel('A').point(lambda a:255 if a>96 else 0).getbbox();sprites[row,col]=im.crop(bbox)
def sprite(im,row,t,x,bottom,height=145,phase=0,nod=False,tilt=0):
 blink=(t+phase)%5.3
 closed=blink>4.85 and blink<5.05
 if nod and 0.8<t<1.4:closed=True
 sp=sprites[row,int(closed)];h=px(height);w=round(h*sp.width/sp.height)
 sp=sp.resize((w,h),Image.Resampling.NEAREST)
 if tilt:sp=sp.rotate(tilt,resample=Image.Resampling.NEAREST,expand=True);w,h=sp.size
 bob=(math.sin(t*1.4+phase)*3.5 if row==0 else math.sin(t*1.15+phase)*.8)
 if nod and .8<t<1.4:bob+=3*math.sin((t-.8)/.6*math.pi)
 im.paste(sp,(round(px(x)-w/2),round(px(bottom+bob)-h)),sp)
def glow(im,x,y,amount):
 if amount<=0:return
 layer=Image.new('RGBA',(W,H));d=draw(layer)
 d.ellipse((x-38,y-38,x+38,y+38),fill=(93,221,209,int(34*amount)))
 layer=layer.filter(ImageFilter.GaussianBlur(px(18)));im.paste(layer,(0,0),layer)
def characters(im,t,chapter):
 # The pair advances along one path. Search -> discovery -> official-app handoff.
 if chapter in (0,6):
  q=ease(t/2)
  sprite(im,0,t,781+(9*q if chapter==6 else 0),518,151)
  sprite(im,1,t,966-(7*q if chapter==6 else 0),518,151,1.5,chapter==6)
  return
 bottom=650;h=100;walk=0;hop=0;tilt=0
 if chapter==1:
  q=ease((t-1)/2.5);sx=170+45*q;wx=100+50*q
  walk=math.sin(q*math.pi*6)*2 if 0<q<1 else 0
 elif chapter==2:
  q=ease(t/2.7);sx=215+115*q;wx=150+95*q
  walk=math.sin(q*math.pi*8)*2 if q<1 else 0
  if t<2.7:tilt=math.sin(t*4)*6
  if 2.7<t<3.7:hop=math.sin((t-2.7)*math.pi)*15
  glow(im,sx,bottom-55,ease((t-2.7)/.6))
  if 2.8<t<4.3:
   a=math.sin((t-2.8)/1.5*math.pi);d=draw(im,'RGBA');x=sx+42;y=bottom-112
   d.rectangle((x-6,y-1,x+6,y+1),fill=(239,204,135,int(220*a)))
   d.rectangle((x-1,y-6,x+1,y+6),fill=(239,204,135,int(220*a)))
 else:
  q=ease((t-.35)/3) if chapter==3 else 1
  sx=330+150*q;wx=245+145*ease((t-.8)/3) if chapter==3 else 390
  walk=math.sin(q*math.pi*10)*2.5 if 0<q<1 else 0
  tilt=-3*q;glow(im,sx,bottom-55,.6)
 # Three small stepping stones carry the visual progression across the cuts.
 d=draw(im)
 for j,x in enumerate((170,330,480)):
  color=GOLD if j<chapter else '#3b3a43'
  d.rounded_rectangle((x-5,659,x+5,661),radius=1,fill=color)
 sprite(im,0,t,sx,bottom-hop+walk,h,tilt=tilt)
 sprite(im,1,t,wx,bottom-abs(walk),h,1.5,chapter==2,tilt=-walk*.8)
def atmosphere(im,t):
 d=draw(im,'RGBA')
 for i,(x,y) in enumerate([(736,412),(879,354),(1010,464),(1125,393)]):
  a=int((.5+.5*math.sin(t*1.1+i*1.7))*95);yy=y-8*math.sin(t*.5+i)
  d.rectangle((x,yy,x+2,yy+2),fill=(255,202,124,a))
def header(im,label=None):
 text(im,(64,34),'found.',37,INK,700)
 if label:text(im,(VW-64-draw(im).textlength(label,font=font(16)),48),label,16,MUTED)
def footer(im,s):text(im,(64,677),s,15,MUTED)
def panel(im,name,xy,width,t,radius=0,feather=False,inset=0):
 # Exact browser crop. Its own border is the only border; no editorial frame.
 src=shots[name];content_width=px(width-2*inset)
 content=src.resize((content_width,round(src.height*content_width/src.width)),Image.Resampling.LANCZOS).convert('RGB')
 size=(px(width),content.height+2*px(inset))
 p=Image.new('RGB',size,BG);p.paste(content,(px(inset),px(inset)))
 mask=Image.new('L',size,255)
 if inset:
  mask=Image.new('L',(size[0]*2,size[1]*2));md=ImageDraw.Draw(mask)
  md.rounded_rectangle((0,0,size[0]*2-1,size[1]*2-1),radius=px(14)*2,fill=255)
  mask=mask.resize(size,Image.Resampling.LANCZOS)
 elif radius:
  # Match the existing UI radius at the source capture's two-pixel scale.
  mask=Image.new('L',(size[0]*2,size[1]*2));md=ImageDraw.Draw(mask)
  md.rounded_rectangle((0,0,size[0]*2-1,size[1]*2-1),radius=radius*size[0]/src.width*2,fill=255)
  mask=mask.resize(size,Image.Resampling.LANCZOS)
 elif feather:
  mask=Image.new('L',size);md=ImageDraw.Draw(mask)
  md.rectangle((8,8,size[0]-9,size[1]-9),fill=255);mask=mask.filter(ImageFilter.GaussianBlur(5))
 x,y=xy;dy=14*(1-ease(t/.6))
 im.paste(p,(px(x),px(y+dy)),mask)
def step(im,num,ss,sub=None):
 text(im,(64,176),num,18,GOLD,600);lines(im,64,215,ss,50,59)
 if sub:text(im,(64,370),sub,22,MUTED)
shots={s:Image.open(C/f'{s}-hd.jpg') for s in ['02-account','03-linear','04-handoff','05-metapool','06-waiting']}
# Each shot uses genuine captured pixels. Crops/size changes are editorial framing.
def scene(i,t):
 im=(plate if i in [0,6] else dim).copy();atmosphere(im,t);header(im,'NEAR MAINNET' if i in [0,6] else 'FOUND / PRODUCT DEMO')
 if i==0:
  lines(im,64,228,['Unstaked your NEAR?','It might still be','waiting for you.'],58,67)
  text(im,(65,483),'Find the final withdrawal you missed.',22,MUTED)
  characters(im,t,i)
 elif i==1:
  text(im,(64,176),'01 / LOOK',18,GOLD,600)
  lines(im,64,214,['Paste a','NEAR account.'],50,60)
  panel(im,'02-account',(52,390),600,t,feather=True)
  characters(im,t,i)
  footer(im,'Real app capture · ru.near is a public example · 10 Nov 2026')
  # A soft tap indicator points to the real Find my NEAR button.
  if 3.4<t<4.1:
   q=(t-3.4)/.7;r=12+q*24;d=draw(im,'RGBA');d.ellipse((572-r,458-r,572+r,458+r),outline=(238,199,124,int(180*(1-q))),width=2)
 elif i==2:
  step(im,'02 / FIND',['See what’s','ready.'],'A live read. No wallet connection.')
  panel(im,'03-linear',(638,150),550,t,radius=24)
  characters(im,t,i)
  footer(im,'Public example · LiNEAR · block 223,963,212 · recorded 10 Nov 2026')
 elif i==3:
  step(im,'03 / WITHDRAW',['Use the','official app.'],'Only the owner can approve.')
  panel(im,'04-handoff',(711,105),430,t,radius=44)
  characters(im,t,i)
  footer(im,'Withdrawal instructions shown · no withdrawal was sent')
 elif i==4:
  step(im,'TWO PROTOCOLS',['One account.','One check.'],'LiNEAR + Meta Pool')
  panel(im,'05-metapool',(638,150),550,t,radius=24)
  characters(im,t,i)
  footer(im,'Public example · lb3.near · Meta Pool · block 223,963,271 · 10 Nov 2026')
 elif i==5:
  step(im,'PUBLIC, REPRODUCIBLE DATA',['538 accounts.','NEAR waiting.'],'47,882 LiNEAR accounts checked.')
  panel(im,'06-waiting',(613,170),608,t,inset=24)
  text(im,(626,620),'Matured balances, not proven lost funds.',18,MUTED)
  characters(im,t,i)
  footer(im,'LiNEAR only · balances above 0.01 NEAR · snapshot 9 Nov 2026')
 else:
  lines(im,64,220,['Find the NEAR','you left behind.'],58,69)
  text(im,(65,392),'LiNEAR + Meta Pool',24,GOLD,600)
  text(im,(65,433),'No custody. No finder’s fee.',22,MUTED)
  characters(im,t,i)
  text(im,(65,578),'Try FOUND',24,INK,600)
  text(im,(65,617),'found-production-e549.up.railway.app',21,GOLD)
  im.paste(near_mark,(px(65),px(672)),near_mark)
  text(im,(101,672),'Built on NEAR',18,INK,500)
 return im
DUR=[5,5,7,7,6,7,7];TOTAL=sum(DUR);START=[];v=0
for d in DUR:START.append(v);v+=d
def frame(t):
 idx=max(i for i,s in enumerate(START) if t>=s);local=t-START[idx]
 im=scene(idx,local)
 if idx and local<.35:im=Image.blend(scene(idx-1,DUR[idx-1]),im,ease(local/.35))
 d=draw(im);d.rectangle((0,717,int(VW*t/TOTAL),719),fill=GOLD)
 return im
if '--stills' in sys.argv:
 for i,s in enumerate(START):frame(s+2).save(O/f'scene-{i+1}.jpg',quality=94)
 frame(2).save(O/'poster.png')
 sheet=Image.new('RGB',(960,270*4),BG)
 for i,s in enumerate(START):sheet.paste(frame(s+2).resize((480,270)),((i%2)*480,(i//2)*270))
 sheet.save(O/'storyboard.jpg',quality=94)
else:
 silent='--silent' in sys.argv
 if not silent:subprocess.run([sys.executable,str(ROOT/'narrate.py')],check=True)
 target=O/('found-demo-silent.mp4' if silent else 'found-demo.mp4')
 cmd=['ffmpeg','-hide_banner','-loglevel','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-']
 cmd+=['-an'] if silent else ['-i',str(O/'narration.m4a'),'-map','0:v','-map','1:a','-c:a','copy']
 cmd+=['-c:v','libx264','-preset','fast','-crf','16','-pix_fmt','yuv420p','-t',str(TOTAL),'-movflags','+faststart',str(target)]
 process=subprocess.Popen(cmd,stdin=subprocess.PIPE)
 for n in range(TOTAL*FPS):
  process.stdin.write(frame(n/FPS).tobytes())
  if n%300==0:print(f'Rendered {n/FPS:.0f}/{TOTAL}s',flush=True)
 process.stdin.close();assert process.wait()==0
 print(f'Saved {target}',flush=True)
