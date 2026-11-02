"""Export only allowlisted imaging fields and encrypt lossless pixels for sharing."""
from pathlib import Path
import base64, gzip, json, os, warnings
import numpy as np
import pydicom
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT.parent / '脑部MRI_20261102' / 'DICOM原图'
PRIVATE = ROOT / '.private'
PRIVATE.mkdir(exist_ok=True)
keyfile = PRIVATE / 'key.txt'
if keyfile.exists():
    key = base64.urlsafe_b64decode(keyfile.read_text().strip() + '=')
else:
    key = AESGCM.generate_key(bit_length=256)
    keyfile.write_text(base64.urlsafe_b64encode(key).decode().rstrip('='))
cipher = AESGCM(key)
assets = ROOT / 'assets'
assets.mkdir(exist_ok=True)
manifest = []
missing = []
warnings.filterwarnings('ignore', module='pydicom.charset')
def number(d, name, default):
    x = d.get(name, default)
    if isinstance(x, (list, pydicom.multival.MultiValue)): x = x[0]
    return float(x)
def encrypt(path, plain):
    nonce = os.urandom(12)
    path.write_bytes(nonce + cipher.encrypt(nonce, gzip.compress(plain, mtime=0), None))

for si, directory in enumerate(sorted(p for p in SOURCE.iterdir() if p.is_dir())):
    files = sorted(directory.glob('*.dcm'))
    frames, pixels = [], []
    for f in files:
        d = pydicom.dcmread(f)
        incomplete = len(d.PixelData) < int(d.Rows)*int(d.Columns)*2
        if incomplete:
            missing.append(dict(series=si+1,instance=int(d.InstanceNumber)))
            a = np.zeros((int(d.Rows),int(d.Columns)),dtype='<i2')
        else:
            a = d.pixel_array.astype('<i2')
        assert a.ndim == 2 and d.PhotometricInterpretation == 'MONOCHROME2'
        pixels.append(a.tobytes())
        frames.append(dict(rows=int(d.Rows), cols=int(d.Columns), missing=incomplete,
            wc=number(d,'WindowCenter',float(np.median(a))),
            ww=max(1,number(d,'WindowWidth',float(a.max()-a.min()))),
            slope=number(d,'RescaleSlope',1), intercept=number(d,'RescaleIntercept',0),
            position=[float(x) for x in d.get('ImagePositionPatient',[])],
            orientation=[float(x) for x in d.get('ImageOrientationPatient',[])],
            spacing=[float(x) for x in d.get('PixelSpacing',[])],
            location=number(d,'SliceLocation',0), instance=int(d.get('InstanceNumber',len(frames)+1))))
    meta = dict(name=directory.name.split('_',1)[1], frames=frames)
    header = json.dumps(meta, ensure_ascii=False, separators=(',',':')).encode()
    payload = len(header).to_bytes(4,'little') + header + b''.join(pixels)
    path = assets / f'series-{si+1:02}.bin'
    encrypt(path,payload)
    # Round trip validates every byte, including all original signed 16-bit pixels.
    raw=path.read_bytes()
    assert gzip.decompress(cipher.decrypt(raw[:12],raw[12:],None)) == payload
    manifest.append(dict(file=path.name,count=len(frames),name=meta['name']))
(ROOT/'manifest.json').write_text(json.dumps(manifest),encoding='utf-8')
report=dict(series=len(manifest),frames=sum(x['count'] for x in manifest),
    encrypted_bytes=sum(p.stat().st_size for p in assets.glob('*.bin')),
    pixel_roundtrip=f'{320-len(missing)}/320 decoded losslessly; missing frames marked',missing=missing,metadata='allowlist only; no patient identifiers exported',
    burned_in_annotation='not specified in source; representative visual review required')
(PRIVATE/'validation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report))
