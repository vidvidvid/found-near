#!/usr/bin/env python3
"""Assemble the existing generated narration, extending only inter-scene pauses."""
from pathlib import Path
import json,subprocess
root=Path(__file__).resolve().parent
meta=json.loads((root/'narration-timing.json').read_text())
files=list(dict.fromkeys(p.get("source_file","assets/narration-source.flac") for p in meta["phrases"]))
inputs=[]
for name in files:inputs += ["-i",str(root/name)]
filters=[]
for i,p in enumerate(meta['phrases']):
 start,end=p['source']
 source_index=files.index(p.get('source_file','assets/narration-source.flac'))
 filters.append(f"[{source_index}:a]atrim=start={start}:end={end},asetpts=PTS-STARTPTS,afade=t=in:d=0.015,afade=t=out:st={end-start-.02}:d=0.02,adelay={round(p['at']*1000)}:all=1[a{i}]")
labels=''.join(f'[a{i}]' for i in range(len(meta['phrases'])))
filters.append(f"{labels}amix=inputs={len(meta['phrases'])}:normalize=0,loudnorm=I=-18:TP=-2:LRA=7,apad=whole_dur={meta['duration']},atrim=duration={meta['duration']}[voice]")
subprocess.run(['ffmpeg','-v','error','-y',*inputs,'-filter_complex',';'.join(filters),'-map','[voice]','-ar','48000','-c:a','aac','-b:a','192k',str(root/'output/narration.m4a')],check=True)
def stamp(t):
 ms=round(t*1000);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02}.{ms%1000:03}'
vtt=['WEBVTT','']
for i,p in enumerate(meta['phrases']):
 end=p['at']+p['source'][1]-p['source'][0]
 if i+1<len(meta['phrases']):end=min(end,meta['phrases'][i+1]['at'])
 vtt += [f"{stamp(p['at'])} --> {stamp(end)}",p['text'],'']
(root/'output/captions.vtt').write_text('\n'.join(vtt))
