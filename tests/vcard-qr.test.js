const test = require('node:test');
const assert = require('node:assert/strict');
const { qrOptions, renderQr } = require('../backend/services/vcard-qr.service');

test('QR options restrict sizes, styles and SVG colors', () => {
  assert.deepEqual(qrOptions('{"size":768,"style":"dots","foreground":"#123456","background":"#fefefe"}'), {size:768,style:'dots',foreground:'#123456',background:'#fefefe'});
  assert.deepEqual(qrOptions({size:999999,style:'<script>',foreground:'" onload="alert(1)',background:'red'}),qrOptions(null));
  assert.deepEqual(qrOptions('https://example.test/legacy-qr-image.png'),qrOptions({}));
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
