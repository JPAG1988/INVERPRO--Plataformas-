import json, os, numpy as np, rasterio, time
from rasterio.windows import from_bounds
from rasterio.enums import Resampling
import concurrent.futures as cf
os.environ.update(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR', AWS_NO_SIGN_REQUEST='YES', CPL_VSIL_CURL_ALLOWED_EXTENSIONS='.tif',
  CURL_CA_BUNDLE='/root/.ccr/ca-bundle.crt', GDAL_HTTP_MAX_RETRY='5', GDAL_HTTP_RETRY_DELAY='2', GDAL_HTTP_MULTIRANGE='YES', GDAL_HTTP_MERGE_CONSECUTIVE_RANGES='YES')
G=json.load(open('geom.json')); x0,y0,x1,y1,nx,ny=G['grid']
items=json.load(open('items.json'))
# dedupe by date: keep highest processing (_1 over _0)
byd={}
for it in items:
    d=it['properties']['datetime'][:10]
    if d not in byd or it['id']>byd[d]['id']: byd[d]=it
items=[byd[d] for d in sorted(byd)]
def read(href,res,rs=Resampling.nearest,bands=None):
    with rasterio.open(href) as src:
        w=from_bounds(x0,y0,x1,y1,src.transform)
        a=src.read(bands or 1,window=w,out_shape=((len(bands),ny,nx) if bands else (ny,nx)),resampling=rs,boundless=True,fill_value=0)
    return a
def scale(it,k,a):
    rb=it['assets'][k].get('raster:bands',[{}])[0]
    s=rb.get('scale',1e-4); o=rb.get('offset',0)
    a=a.astype('float32'); a[a==0]=np.nan
    return a*s+o
def one(it):
    A=it['assets']
    for t in range(3):
        try:
            scl=read(A['scl']['href'],20)
            red=scale(it,'red',read(A['red']['href'],10)); nir=scale(it,'nir',read(A['nir']['href'],10))
            re1=scale(it,'rededge1',read(A['rededge1']['href'],20,Resampling.bilinear)); sw=scale(it,'swir16',read(A['swir16']['href'],20,Resampling.bilinear))
            return it['properties']['datetime'][:10],it['id'],scl,red,nir,re1,sw
        except Exception as e:
            err=e; time.sleep(2)
    print('FAIL',it['id'],err); return None
t=time.time(); out=[]
with cf.ThreadPoolExecutor(8) as ex:
    for r in ex.map(one,items):
        if r: out.append(r)
print('read',len(out),'in',round(time.time()-t),'s')
d=[r[0] for r in out]; ids=[r[1] for r in out]
np.savez_compressed('stack.npz',dates=np.array(d),ids=np.array(ids),scl=np.stack([r[2] for r in out]),red=np.stack([r[3] for r in out]),nir=np.stack([r[4] for r in out]),re1=np.stack([r[5] for r in out]),sw=np.stack([r[6] for r in out]))
