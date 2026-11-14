"""Trace the church crest (presbyterian-web/public/crest.png) into clean shapes for the app.

The opening screen draws the crest in, which needs shapes rather than a picture. Each colour
(navy flames, red flames, the cross outline and its white centre) is traced on its own.
Run: pip install pillow numpy potracer, then
python scripts/trace-crest.py ../presbyterian-web/public/crest.png > src/components/crestPaths.js
"""
import sys, numpy as np, potrace
from PIL import Image, ImageFilter
SCALE=8
im=Image.open(sys.argv[1]).convert('RGBA')
W,H=im.size
big=im.resize((W*SCALE,H*SCALE),Image.LANCZOS)
a=np.asarray(big).astype(float)
rgb,al=a[...,:3],a[...,3]
def near(col,tol=60): return (np.linalg.norm(rgb-np.array(col),axis=-1)<tol)&(al>128)
navy=near((28,38,109),70); red=near((206,43,38),70)
cross=(al>128)&~navy&~red
white=cross&(rgb.min(axis=-1)>150)
def smooth(m,blur=0.6):
    img=Image.fromarray((m*255).astype('uint8')).filter(ImageFilter.GaussianBlur(SCALE*blur))
    return np.asarray(img)>127
def trace(m,alpha=1.0,blur=0.6):
    bm=potrace.Bitmap(~smooth(m,blur))
    plist=bm.trace(turdsize=SCALE*SCALE*6,alphamax=alpha,opticurve=True,opttolerance=0.4)
    f=lambda p:f"{p.x/SCALE:.2f} {p.y/SCALE:.2f}"
    parts=[]
    for c in plist:
        d=[f"M{f(c.start_point)}"]
        for s in c.segments:
            if s.is_corner: d.append(f"L{f(s.c)}L{f(s.end_point)}")
            else: d.append(f"C{f(s.c1)} {f(s.c2)} {f(s.end_point)}")
        parts.append("".join(d)+"Z")
    return parts
out={'cross':trace(cross,0.55,0.3),'white':trace(white,0.55,0.3),'navy':trace(navy),'red':trace(red)}
import json
print("// The church crest as shapes, traced from presbyterian-web/public/crest.png by")
print("// scripts/trace-crest.py. Don't edit by hand: run the script again instead.")
print(f"export const CREST_SIZE = {{ width: {W}, height: {H} }};")
for k in ('navy', 'red', 'cross', 'white'):
    print(f"export const {k.upper()} = {json.dumps(out[k])};")
