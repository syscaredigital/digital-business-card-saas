const QRCode = require('qrcode');

function qrOptions(value) {
  let input = value;
  if (typeof input === 'string') { try { input = JSON.parse(input); } catch (_) { input = {}; } }
  input = input && typeof input === 'object' ? input : {};
  const color = (value, fallback) => /^#[0-9a-f]{6}$/i.test(value || '') ? value : fallback;
  return {
    size: [256, 384, 512, 768, 1024].includes(Number(input.size)) ? Number(input.size) : 512,
    foreground: color(input.foreground, '#111827'),
    background: color(input.background, '#ffffff'),
    style: ['square', 'rounded', 'dots'].includes(input.style) ? input.style : 'square',
  };
}

function renderQr(destination, value) {
  const options = qrOptions(value);
  const { modules } = QRCode.create(destination, { errorCorrectionLevel: 'H' });
  const count = modules.size, extent = count + 8, shapes = [];
  for (let y = 0; y < count; y++) for (let x = 0; x < count; x++) {
    if (!modules.get(y, x)) continue;
    // Keep finder patterns square so decorative modules remain easy to scan.
    const finder = (x < 8 && y < 8) || (x >= count - 8 && y < 8) || (x < 8 && y >= count - 8);
    const px = x + 4, py = y + 4;
    shapes.push(!finder && options.style === 'dots'
      ? `<circle cx="${px + .5}" cy="${py + .5}" r=".48"/>`
      : `<rect x="${px}" y="${py}" width="1" height="1"${!finder && options.style === 'rounded' ? ' rx=".25"' : ''}/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${options.size}" height="${options.size}" viewBox="0 0 ${extent} ${extent}"><rect width="${extent}" height="${extent}" fill="${options.background}"/><g fill="${options.foreground}">${shapes.join('')}</g></svg>`;
}

async function renderQrPng(destination, value) {
  // Rasterize the same artwork so colors, module style and quiet zone match SVG.
  return require('sharp')(Buffer.from(renderQr(destination, value))).png().toBuffer();
}

module.exports = { qrOptions, renderQr, renderQrPng };
