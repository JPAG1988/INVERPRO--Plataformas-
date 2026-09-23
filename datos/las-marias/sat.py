import json, re, numpy as np, rasterio, os, sys
from rasterio.windows import from_bounds
from pyproj import Transformer
from shapely.geometry import Polygon, Point
from shapely.ops import transform as stransform
import concurrent.futures as cf
os.environ.update(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR', AWS_NO_SIGN_REQUEST='YES', CPL_VSIL_CURL_ALLOWED_EXTENSIONS='.tif',
  CURL_CA_BUNDLE='/root/.ccr/ca-bundle.crt', GDAL_HTTP_MAX_RETRY='4', GDAL_HTTP_RETRY_DELAY='1', VSI_CACHE='TRUE')
tr=Transformer.from_crs(4326,32618,always_xy=True)
kml=open('Las_Marias.kml',encoding='utf-8').read()
pms=re.findall(r'<Placemark.*?</Placemark>',kml,re.S)
feat=[]
for pm in pms:
    name=re.search(r'<name>(.*?)</name>',pm).group(1).strip()
    vis=re.search(r'<visibility>0</visibility>',pm) is None
    co=re.search(r'<coordinates>\s*(.*?)\s*</coordinates>',pm,re.S).group(1).split()
    pts=[tuple(map(float,c.split(',')[:2])) for c in co]
    kind='poly' if '<Polygon>' in pm else 'point'
    feat.append(dict(name=name,kind=kind,vis=vis,ll=pts))
def utm(pts): return [tr.transform(x,y) for x,y in pts]
for f in feat: f['utm']=utm(f['ll'])
lind=[f for f in feat if f['name']=='Las Marias'][0]
L=Polygon(lind['utm'])
print('lindero ha',L.area/1e4)
for f in feat:
    if f['kind']=='poly': print(f['name'],round(Polygon(f['utm']).area/1e4,3))
minx,miny,maxx,maxy=L.bounds; M=300
x0=np.floor((minx-M)/10)*10; y1=np.ceil((maxy+M)/10)*10; x1=np.ceil((maxx+M)/10)*10; y0=np.floor((miny-M)/10)*10
nx=int((x1-x0)/10); ny=int((y1-y0)/10); print('grid',nx,ny)
json.dump(dict(feat=feat,grid=[x0,y0,x1,y1,nx,ny]),open('geom.json','w'))
