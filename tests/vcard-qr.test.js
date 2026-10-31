const test = require('node:test');
const assert = require('node:assert/strict');
const { qrOptions, renderQr, renderQrPng } = require('../backend/services/vcard-qr.service');

test('QR options restrict sizes, styles and SVG colors', () => {
  assert.deepEqual(qrOptions('{"size":768,"style":"dots","foreground":"#123456","background":"#fefefe"}'), {size:768,style:'dots',foreground:'#123456',background:'#fefefe'});
  assert.deepEqual(qrOptions({size:999999,style:'<script>',foreground:'" onload="alert(1)',background:'red'}),qrOptions(null));
  assert.deepEqual(qrOptions('https://example.test/legacy-qr-image.png'),qrOptions({}));
});

test('PNG downloads preserve SVG dimensions, colors and decorative styles', async () => {
  const sharp = require('sharp');
  for (const style of ['square', 'rounded', 'dots']) {
    const options = {size:768, style, foreground:'#123456', background:'#fefefe'};
    const destination = 'https://example.test/SysCare-!IDuyIs_&W9T?source=qr';
    const png = await renderQrPng(destination, options);
    assert.equal(png.subarray(0,8).toString('hex'), '89504e470d0a1a0a');
    const metadata = await sharp(png).metadata();
    assert.equal(metadata.format, 'png');
    assert.equal(metadata.width, 768);
    assert.equal(metadata.height, 768);
    const actual = await sharp(png).raw().toBuffer();
    const expected = await sharp(Buffer.from(renderQr(destination, options))).raw().toBuffer();
    assert.deepEqual(actual, expected);
  }
});

test('QR renderer applies appearance while encoding the supplied VCard destination', () => {
  const destination = 'https://example.test/vcard/avery?source=qr';
  const square = renderQr(destination,{size:256,foreground:'#123456',background:'#fefefe'});
  assert.match(square,/width="256" height="256"/);
  assert.match(square,/fill="#123456"/);assert.match(square,/fill="#fefefe"/);
  assert.doesNotMatch(square,/<circle|rx=/);
  assert.match(renderQr(destination,{style:'rounded'}),/rx=".25"/);
  assert.match(renderQr(destination,{style:'dots'}),/<circle/);
  assert.notEqual(renderQr(destination,{}),renderQr('https://example.test/vcard/another',{}));
});
