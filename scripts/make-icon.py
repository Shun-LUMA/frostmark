from pathlib import Path
from PIL import Image, ImageDraw
root = Path(__file__).resolve().parents[1]
folder = root / 'src-tauri' / 'icons'
folder.mkdir(parents=True, exist_ok=True)
im = Image.new('RGBA', (256, 256), (0,0,0,0))
d = ImageDraw.Draw(im)
d.rounded_rectangle((4,4,252,252),radius=56,fill='#2377a1')
d.polygon([(52,62),(112,62),(128,76),(144,62),(204,62),(204,190),(145,190),(128,201),(111,190),(52,190)],fill='#f3f9ff')
d.line([(128,80),(128,181)],fill='#2377a1',width=7)
for y in (97,119,141):
    d.line([(68,y),(105,y)],fill='#a4c8df',width=5)
    d.line([(151,y),(188,y)],fill='#a4c8df',width=5)
im.save(folder / 'icon.ico',sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
im.save(folder / 'icon.png')
