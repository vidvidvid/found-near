#!/usr/bin/env python3
"""Render an editorial demo from real browser captures and generated animation assets.
Requires Python + Pillow and ffmpeg. No browser state is fabricated.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math, subprocess, json, sys
ROOT=Path(__file__).resolve().parent
A=ROOT/'assets'; C=ROOT/'captures'; O=ROOT/'output'; O.mkdir(exist_ok=True)
W,H,FPS=1280,720,30
BG=(8,11,20); INK='#eee9db'; GOLD='#ecc77e'; MUTED='#a4a5b0'
FONTS={}
def font(n,weight=500):
 k=(n,weight)
 if k not in FONTS:FONTS[k]=ImageFont.truetype(str(A/f'dm-sans-{weight}.ttf'),n)
 return FONTS[k]
def text(im,xy,s,n=24,color=INK,weight=500):ImageDraw.Draw(im).text(xy,s,font=font(n,weight),fill=color,spacing=5)
def lines(im,x,y,ss,n=54,step=64,color=INK):
 for j,s in enumerate(ss):text(im,(x,y+j*step),s,n,color,600)
def ease(v):v=max(0,min(1,v));return v*v*(3-2*v)
plate=Image.open(A/'night-plate.png').convert('RGB').resize((1280,853),Image.Resampling.LANCZOS).crop((0,65,1280,785))
dim=Image.blend(Image.new('RGB',(W,H),BG),plate,.20)
atlas=Image.open(A/'characters.png').convert('RGBA');cw,ch=atlas.width//2,atlas.height//2
sprites={}
for row in range(2):
 for col in range(2):
  im=atlas.crop((col*cw,row*ch,(col+1)*cw,(row+1)*ch));bbox=im.getchannel('A').point(lambda a:255 if a>96 else 0).getbbox();sprites[row,col]=im.crop(bbox)
def sprite(im,row,t,x,bottom,height=145,phase=0,nod=False):
 blink=(t+phase)%5.3
 closed=blink>4.85 and blink<5.05
 if nod and 0.8<t<1.4:closed=True
 sp=sprites[row,int(closed)];h=height;w=round(h*sp.width/sp.height)
 sp=sp.resize((w,h),Image.Resampling.NEAREST)
 bob=(math.sin(t*1.4+phase)*3.5 if row==0 else math.sin(t*1.15+phase)*.8)
 if nod and .8<t<1.4:bob+=3*math.sin((t-.8)/.6*math.pi)
 im.paste(sp,(round(x-w/2),round(bottom-h+bob)),sp)
def characters(im,t,stage=True,nod=False):
 if stage:
  sprite(im,0,t,781,518,151);sprite(im,1,t,966,518,151,1.5,nod)
 else:
  sprite(im,0,t,135,603,112);sprite(im,1,t,268,606,116,1.5,nod)
def atmosphere(im,t):
 d=ImageDraw.Draw(im,'RGBA')
 for i,(x,y) in enumerate([(736,412),(879,354),(1010,464),(1125,393)]):
  a=int((.5+.5*math.sin(t*1.1+i*1.7))*95);yy=y-8*math.sin(t*.5+i)
  d.rectangle((x,yy,x+2,yy+2),fill=(255,202,124,a))
def header(im,label=None):
 text(im,(64,34),'found.',37,INK,700)
 if label:text(im,(W-64-ImageDraw.Draw(im).textlength(label,font=font(16)),48),label,16,MUTED)
def footer(im,s):text(im,(64,677),s,15,MUTED)
def panel(im,src,box,size,xy,t,framed=True):
 p=src.crop(box).convert('RGB').resize(size,Image.Resampling.LANCZOS)
 x,y=xy;dy=round(14*(1-ease(t/.6)))
 if framed:
  shadow=Image.new('RGBA',(W,H));d=ImageDraw.Draw(shadow);d.rounded_rectangle((x-4,y+dy-4,x+size[0]+4,y+dy+size[1]+4),14,fill=(0,0,0,170));shadow=shadow.filter(ImageFilter.GaussianBlur(12));im.paste(shadow,(0,0),shadow)
 mask=Image.new('L',size);ImageDraw.Draw(mask).rounded_rectangle((0,0,size[0]-1,size[1]-1),12,fill=255)
 if not framed:
  mask=Image.new('L',size);ImageDraw.Draw(mask).rectangle((15,15,size[0]-16,size[1]-16),fill=255);mask=mask.filter(ImageFilter.GaussianBlur(8))
 im.paste(p,(x,y+dy),mask)
 if framed:ImageDraw.Draw(im).rounded_rectangle((x,y+dy,x+size[0]-1,y+dy+size[1]-1),12,outline='#3e3b48',width=1)
def step(im,num,ss,sub=None):
 text(im,(64,176),num,18,GOLD,600);lines(im,64,215,ss,50,59)
 if sub:text(im,(64,370),sub,22,MUTED)
shots={s:Image.open(C/f'{s}.jpg') for s in ['02-account','03-linear','04-handoff','05-metapool','06-waiting']}
# Each shot uses genuine captured pixels. Crops/size changes are editorial framing.
def scene(i,t):
 im=(plate if i in [0,6] else dim).copy();atmosphere(im,t);header(im,'NEAR MAINNET' if i in [0,6] else 'FOUND / PRODUCT DEMO')
 if i==0:
  lines(im,64,228,['Unstaked NEAR?','It may still','be waiting.'],58,67)
  text(im,(65,483),'Find the final withdrawal you missed.',22,MUTED)
  characters(im,t)
 elif i==1:
  text(im,(64,176),'01 / LOOK',18,GOLD,600)
  lines(im,64,214,['Paste a','NEAR account.'],50,60)
  panel(im,shots['02-account'],(48,450,668,614),(620,164),(64,390),t,framed=False)
  characters(im,t)
  footer(im,'Real app capture · ru.near is a public example · 10 Nov 2026')
  # A soft tap indicator points to the real Find my NEAR button.
  if 3.4<t<4.1:
   q=(t-3.4)/.7;r=12+q*24;d=ImageDraw.Draw(im,'RGBA');d.ellipse((566-r,471-r,566+r,471+r),outline=(238,199,124,int(180*(1-q))),width=2)
 elif i==2:
  step(im,'02 / FIND',['See what’s','ready.'],'A live read. No wallet connection.')
  panel(im,shots['03-linear'],(683,148,1202,500),(571,387),(638,171),t)
  characters(im,t,False,True)
  footer(im,'Public example · LiNEAR · block 223,950,238 · recorded 10 Nov 2026')
 elif i==3:
  step(im,'03 / WITHDRAW',['Use the','official app.'],'Only the owner can approve.')
  panel(im,shots['04-handoff'],(419,80,862,641),(443,561),(711,103),t)
  characters(im,t,False)
  footer(im,'Withdrawal instructions shown · no withdrawal was sent')
 elif i==4:
  step(im,'TWO PROTOCOLS',['One account.','One check.'],'LiNEAR + Meta Pool')
  panel(im,shots['05-metapool'],(683,173,1202,524),(571,386),(638,171),t)
  characters(im,t,False,True)
  footer(im,'Public example · lb3.near · Meta Pool · block 223,950,463 · 10 Nov 2026')
 elif i==5:
  step(im,'PUBLIC, REPRODUCIBLE DATA',['538 accounts.','NEAR waiting.'],'47,882 LiNEAR accounts checked.')
  panel(im,shots['06-waiting'],(78,273,1204,707),(584,225),(625,222),t)
  text(im,(626,479),'Matured balances, not proven lost funds.',18,MUTED)
  characters(im,t,False)
  footer(im,'LiNEAR only · balances above 0.01 NEAR · snapshot 9 Nov 2026')
 else:
  lines(im,64,220,['Find the NEAR','you left behind.'],58,69)
  text(im,(65,392),'LiNEAR + Meta Pool',24,GOLD,600)
  text(im,(65,433),'No custody. No finder’s fee.',22,MUTED)
  characters(im,t,True,True)
  text(im,(65,578),'Try FOUND',24,INK,600)
  text(im,(65,617),'found-production-e549.up.railway.app',21,GOLD)
  footer(im,'Built at NEAR HACKATHON')
 return im
DUR=[5,5,7,7,6,6,7];TOTAL=sum(DUR);START=[];v=0
for d in DUR:START.append(v);v+=d
def frame(t):
 idx=max(i for i,s in enumerate(START) if t>=s);local=t-START[idx]
 im=scene(idx,local)
 if idx and local<.35:im=Image.blend(scene(idx-1,DUR[idx-1]),im,ease(local/.35))
 d=ImageDraw.Draw(im);d.rectangle((0,717,int(W*t/TOTAL),719),fill=GOLD)
 return im
if '--stills' in sys.argv:
 for i,s in enumerate(START):frame(s+2).save(O/f'scene-{i+1}.jpg',quality=94)
 frame(2).save(O/'poster.png')
 sheet=Image.new('RGB',(960,270*4),BG)
 for i,s in enumerate(START):sheet.paste(frame(s+2).resize((480,270)),((i%2)*480,(i//2)*270))
 sheet.save(O/'storyboard.jpg',quality=94)
else:
 cmd=['ffmpeg','-hide_banner','-loglevel','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-an','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(O/'found-demo.mp4')]
 process=subprocess.Popen(cmd,stdin=subprocess.PIPE)
 for n in range(TOTAL*FPS):
  process.stdin.write(frame(n/FPS).tobytes())
  if n%300==0:print(f'Rendered {n/FPS:.0f}/{TOTAL}s',flush=True)
 process.stdin.close();assert process.wait()==0
 print(f'Saved {O/"found-demo.mp4"}',flush=True)
