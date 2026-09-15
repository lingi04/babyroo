import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT_DIR = new URL('.', import.meta.url).pathname;
const WIDTH = 1290;
const HEIGHT = 2796;
const require = createRequire(import.meta.url);

function loadSharp() {
  for (const candidate of ['sharp', '/private/tmp/babyroo-render/node_modules/sharp']) {
    try {
      return require(candidate);
    } catch {
      // Try the next known location.
    }
  }

  throw new Error(
    'This generator needs sharp. Install it temporarily with: npm install sharp --prefix /private/tmp/babyroo-render',
  );
}

const sharp = loadSharp();

const colors = {
  paper: '#F6EEE8',
  paperLight: '#FFFBF7',
  text: '#0E0E0E',
  muted: '#6F675F',
  primary: '#FA6A2E',
  primarySoft: '#FFE1D3',
  mint: '#DFF3E8',
  blue: '#DDEEFF',
  lilac: '#EFE7F5',
  amber: '#FFE3A8',
  white: '#FFFFFF',
  black: '#151515',
};

const escapeXml = value =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const text = (value, x, y, size, weight = 800, fill = colors.text) =>
  `<text x="${x}" y="${y}" font-family="-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" letter-spacing="0">${escapeXml(value)}</text>`;

const screenshot = relativePath => {
  const data = readFileSync(join(OUT_DIR, relativePath)).toString('base64');
  return `<image x="42" y="42" width="778" height="1690" preserveAspectRatio="xMidYMid slice" href="data:image/png;base64,${data}"/>`;
};

const phone = screen => `
  <g transform="translate(214 720)" filter="url(#phoneShadow)">
    <rect x="0" y="0" width="862" height="1774" rx="128" fill="${colors.black}"/>
    <rect x="20" y="20" width="822" height="1734" rx="112" fill="#2C2C2C"/>
    <rect x="42" y="42" width="778" height="1690" rx="92" fill="${colors.white}"/>
    <g clip-path="url(#screenClip)">${screen}</g>
  </g>
`;

const background = variant => {
  const accent =
    variant === 'login'
      ? `<circle cx="1050" cy="680" r="112" fill="${colors.blue}"/><circle cx="222" cy="610" r="76" fill="${colors.mint}"/>`
      : variant === 'detail'
        ? `<rect x="924" y="528" width="220" height="220" rx="64" fill="${colors.amber}" transform="rotate(12 1034 638)"/><circle cx="180" cy="654" r="88" fill="${colors.lilac}"/>`
        : `<circle cx="1082" cy="586" r="108" fill="${colors.mint}"/><rect x="116" y="612" width="174" height="174" rx="52" fill="${colors.amber}" transform="rotate(-14 203 699)"/>`;

  return `
    <rect width="${WIDTH}" height="${HEIGHT}" fill="${colors.paper}"/>
    <circle cx="82" cy="424" r="360" fill="${colors.paperLight}" opacity="0.92"/>
    <circle cx="1190" cy="2140" r="432" fill="${colors.primarySoft}" opacity="0.9"/>
    <path d="M0 2290 C264 2196 438 2364 676 2278 C922 2188 1066 2046 1290 2128 L1290 2796 L0 2796 Z" fill="#FFFFFF" opacity="0.72"/>
    ${accent}
  `;
};

const assets = [
  {
    name: 'babyroo-appstore-01-explore.png',
    svg: 'babyroo-appstore-01-explore.svg',
    headline: ['우리 아이에게 맞는', '갈 곳만 빠르게'],
    sub: '월령 · 지역 · 무료 · 예약 조건까지 한 화면에서',
    screen: screenshot('real-screenshots/01-explore.png'),
    variant: 'explore',
  },
  {
    name: 'babyroo-appstore-02-login.png',
    svg: 'babyroo-appstore-02-login.svg',
    headline: ['아이와 갈 곳을', '더 쉽게 고르세요'],
    sub: '로그인 없이도 바로 둘러볼 수 있어요',
    screen: screenshot('real-screenshots/00-login.png'),
    variant: 'login',
  },
  {
    name: 'babyroo-appstore-03-detail.png',
    svg: 'babyroo-appstore-03-detail.svg',
    headline: ['예약과 가격 정보도', '가기 전에 확인'],
    sub: '행사 소개와 태그, 원문 링크까지 한 번에',
    screen: screenshot('real-screenshots/02-detail.png'),
    variant: 'detail',
  },
];

const svg = asset => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <filter id="phoneShadow" x="-28%" y="-24%" width="156%" height="156%">
      <feDropShadow dx="0" dy="30" stdDeviation="34" flood-color="#111111" flood-opacity="0.18"/>
    </filter>
    <clipPath id="screenClip">
      <rect x="42" y="42" width="778" height="1690" rx="92"/>
    </clipPath>
  </defs>
  ${background(asset.variant)}
  ${text(asset.headline[0], 92, 222, 78, 900)}
  ${text(asset.headline[1], 92, 320, 78, 900)}
  ${text(asset.sub, 96, 392, 30, 800, colors.muted)}
  ${phone(asset.screen)}
</svg>`;

for (const asset of assets) {
  const svgSource = svg(asset);
  writeFileSync(join(OUT_DIR, asset.svg), svgSource, 'utf8');
  await sharp(Buffer.from(svgSource)).png().toFile(join(OUT_DIR, asset.name));
}
