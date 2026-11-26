import sys, importlib.util
from PIL import Image
def render(rows, pal, scale=8, out='o.png', bg=(233,226,210)):
    w=max(len(r) for r in rows); h=len(rows)
    im=Image.new('RGB',(w,h),bg)
    for y,r in enumerate(rows):
        for x,c in enumerate(r):
            if c in pal: im.putpixel((x,y),pal[c])
    im=im.resize((w*scale,h*scale),Image.NEAREST); im.save(out)
