import json,numpy as np,base64,os,rasterio
from shapely.geometry import Polygon, Point
from shapely import contains_xy
from rasterio.windows import from_bounds
os.environ.update(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR', AWS_NO_SIGN_REQUEST='YES', CURL_CA_BUNDLE='/root/.ccr/ca-bundle.crt')
G=json.load(open('geom.json')); x0,y0,x1,y1,nx,ny=G['grid']
S=np.load('stack.npz'); D=list(S['dates']); IDS=list(S['ids'])
xs=x0+5+10*np.arange(nx); ys=y1-5-10*np.arange(ny); X,Y=np.meshgrid(xs,ys)
F={f['name']:f for f in G['feat']}
L=Polygon(F['Las Marias']['utm']); mL=contains_xy(L,X,Y)
lots=[('rec','Potrero recepción','PR'),('p1','Potrero 1','P1'),('p2','Potrero 2','P2'),('p3','Potrero 3','P3'),('p4','Potrero 4','P4')]
masks={k:contains_xy(Polygon(F[n]['utm']),X,Y) for k,n,_ in lots}
# rest of predio = lindero minus potreros
allp=np.zeros_like(mL)
for k in masks: allp|=masks[k]
masks['resto']=mL&~allp
for k,v in masks.items(): print(k,v.sum())
idx=np.flatnonzero(mL.ravel())  # pixel order for grids
def q(a,lo,hi):
    o=np.zeros(a.shape,np.uint8); ok=np.isfinite(a)
    o[ok]=np.clip(np.round((a[ok]-lo)/(hi-lo)*254)+1,1,255).astype(np.uint8); return o
RNG={'ndvi':(-0.1,0.9),'ndre':(-0.1,0.6),'ndmi':(-0.5,0.5)}
scenes=[]
for i,d in enumerate(D):
    scl=S['scl'][i]; valid=np.isin(scl,[4,5,6])
    vfrac=valid[mL].mean(); cl=1-vfrac
    ent={'d':d,'id':IDS[i],'cloud':round(float(cl)*100)}
    if vfrac<.6: scenes.append(ent); continue
    r=S['red'][i]+.1; n=S['nir'][i]+.1; e=S['re1'][i]+.1; s=S['sw'][i]+.1
    with np.errstate(all='ignore'):
        I={'ndvi':(n-r)/(n+r),'ndre':(n-e)/(n+e),'ndmi':(n-s)/(n+s)}
    for k in I: I[k][~valid]=np.nan
    ent['ok']=1; ent['lots']={}
    for lk,mk in masks.items():
        vv=valid[mk].mean()
        if vv<.6: ent['lots'][lk]=None; continue
        ent['lots'][lk]={k:round(float(np.nanmean(I[k][mk])),4) for k in I}
        ent['lots'][lk]['p10']=round(float(np.nanpercentile(I['ndvi'][mk],10)),4)
    ent['all']={k:round(float(np.nanmean(I[k][mL])),4) for k in I}
    ent['g']={k:base64.b64encode(q(I[k].ravel()[idx],*RNG[k]).tobytes()).decode() for k in I}
    scenes.append(ent)
ok=[s for s in scenes if s.get('ok')]
for s in ok: print(s['d'],s['cloud'],s['all'])
# TCI basemap from clearest greenest recent scene
best=max([s for s in ok if s['cloud']==0],key=lambda s:s['d'])
print('basemap',best['d'])
it=[x for x in json.load(open('items.json')) if x['id']==best['id']][0]
with rasterio.open(it['assets']['visual']['href']) as src:
    w=from_bounds(x0,y0,x1,y1,src.transform); tci=src.read([1,2,3],window=w,out_shape=(3,ny,nx),boundless=True)
from PIL import Image, ImageEnhance
im=Image.fromarray(np.transpose(tci,(1,2,0)).astype(np.uint8))
im=ImageEnhance.Contrast(ImageEnhance.Brightness(im).enhance(1.15)).enhance(1.1)
im.save('tci.png'); im.resize((nx*4,ny*4),Image.LANCZOS).save('tci_big.png')
import io
buf=io.BytesIO(); im.save(buf,'PNG',optimize=True); tci_b64=base64.b64encode(buf.getvalue()).decode()
feat=[]
for f in G['feat']:
    if not f['vis']: continue
    feat.append({'name':f['name'].strip(),'kind':f['kind'],'utm':[[round(a,1),round(b,1)] for a,b in f['utm']],'ll':[[round(a,7),round(b,7)] for a,b in f['ll']]})
out={'meta':{'source':'Copernicus Sentinel-2 L2A (ESA), vía Earth Search (Element 84) — AWS Registry of Open Data','tile':'18NZL','epsg':32618,'res':10,
  'from':D[0],'to':D[-1],'total':len(D),'usable':len(ok),'processed':'2026-09-23','mask':'SCL 4,5,6 (vegetación, suelo, agua); escena útil si ≥60 % del predio sin nubes',
  'ranges':RNG,'basemap':best['d']},
  'grid':{'x0':x0,'y0':y0,'x1':x1,'y1':y1,'nx':nx,'ny':ny,'idx':base64.b64encode(np.asarray(idx,dtype='<u4').tobytes()).decode()},
  'lots':[{'k':k,'name':n,'short':s} for k,n,s in lots]+[{'k':'resto','name':'Resto del predio','short':'—'}],
  'feat':feat,'tci':tci_b64,'scenes':scenes}
json.dump(out,open('las-marias-s2.json','w'),separators=(',',':'))
print('size',os.path.getsize('las-marias-s2.json'))
