from PIL import Image, ImageOps, ImageDraw
from pathlib import Path
paths=sorted(Path('design-reference/fueldesk-petrol-lime-v4/previews').glob('*.png'))
for start in range(0,len(paths),6):
    sheet=Image.new('RGB',(1500,1500),'#dce5df')
    for i,p in enumerate(paths[start:start+6]):
        im=Image.open(p); im.thumbnail((740,455))
        x=(i%2)*750; y=(i//2)*500
        ImageDraw.Draw(sheet).text((x+12,y+8),f'{p.name}  {Image.open(p).size}',fill='#003333')
        sheet.paste(im,(x,y+35))
    sheet.save(f'docs/ui-v4/reference-sheet-{start//6+1}.png')
