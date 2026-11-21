// Both native targets bundle this directory. Use static faces for offline rendering.
const fs = require('node:fs');
const path = require('node:path');
const app = path.resolve(__dirname, '..');
const destination = path.join(app, 'android/app/src/main/assets/fonts');
fs.mkdirSync(destination, { recursive: true });

function copy(name) {
  const sourcePath = path.join(app, 'assets/fonts', name);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing bundled font asset: assets/fonts/${name}.`);
  }
  fs.copyFileSync(sourcePath, path.join(destination, name));
}

for (const weight of ['Medium', 'SemiBold', 'Bold']) {
  const name = `Pretendard-${weight}.otf`;
  copy(name);
}
copy('Dosis-ExtraBold.ttf');
copy('Dosis-LICENSE.txt');
copy('Pretendard-LICENSE.txt');
