#!/usr/bin/env python
#
# Extract and convert Another World 15th Anniversary 'Pak01.pak' file to be used with 'another.js'
#

import base64
import io
import re
import struct
import sys
import zlib
from PIL import Image

# The demo version contains all datafiles, restrict to the subset necessary for the demo (introduction and water parts).
# These files are not encrypted.
DEMO_RESOURCES = [ 0x17, 0x18, 0x19, 0x1A, 0x1B, 0x1C, 0x11 ]

BITMAP_W = 640
BITMAP_H = 400
PALETTE_OFFSET = 16

resources = []
bitmaps = []

assert len(sys.argv) == 2
pkf = file(sys.argv[1], 'rb')
tag = pkf.read(4)
assert tag == 'PACK'
offset = struct.unpack('<I', pkf.read(4))[0]

count = 0
while True:
	pkf.seek(offset + 64 * count)
	header = pkf.read(64)
	if len(header) != 64:
		break

	data_offset = struct.unpack('<I', header[56:60])[0]
	data_size   = struct.unpack('<I', header[60:64])[0]
	data_name   = header[:header.index('\0')]
	#print '%s 0x%x %d' % (data_name, data_offset, data_size)

	m = re.match(r'dlx/file(\d\d\d).dat', data_name)
	if m:
		num = int(m.group(1), 10)
		if num in DEMO_RESOURCES:
			resources.append( ( num, data_offset, data_size ) )
	else:
		m = re.match(r'dlx/e(3\d\d\d).bmp', data_name)
		if m:
			num = int(m.group(1), 10)
			bitmaps.append( ( num, data_offset, data_size ) )

	count += 1

resources.sort(key=lambda x: x[0])
for r in resources:
	num = r[0]
	pkf.seek(r[1])
	size = r[2]
	buf = pkf.read(size)
	assert len(buf) == size
	# ensure file is not encrypted (DRM)
	assert buf[:5] != 'TooDC'
	print 'const data%02x = "%s";' % (num, base64.b64encode(zlib.compress(buf)))
	print 'const size%02x = %d;' % (num, size)

bitmaps.sort(key=lambda x: x[0])
print 'const bitmaps = {'
for b in bitmaps:
	num = b[0]
	pkf.seek(b[1])
	size = b[2]
	buf = pkf.read(size)
	img = Image.open(io.BytesIO(buf))
	assert img.width == 1280 and img.height == 800
	img = img.resize((BITMAP_W, BITMAP_H), Image.NEAREST)
	pal = zlib.compress(''.join([ chr(c) for c in img.getpalette() ]))
	pix = zlib.compress(''.join([ chr(PALETTE_OFFSET + c) for c in img.getdata() ]))
	print '\t%3d : [ "%s", "%s" ],' % (num, base64.b64encode(pal), base64.b64encode(pix))
print '};'
