// Converts actual React Native test-renderer output to a source-based HTML preview.
// Not a native screenshot. Run focused card tests with BABYROO_CROWDING_PREVIEW_DIR
// pointing to a writable fixture directory, then: node this-file.cjs <fixture-dir>
const fs = require('node:fs');
const path = require('node:path');
const dir = process.argv[2];
if (!dir) throw new Error('Provide the fixture output directory');
const escape = value =>
  String(value ?? '').replace(
    /[&<>"']/g,
    char =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[
        char
      ]),
  );
const flatten = style =>
  Array.isArray(style) ? Object.assign({}, ...style.map(flatten)) : style || {};
const unitless = new Set([
  'flexGrow',
  'flexShrink',
  'opacity',
  'zIndex',
  'fontWeight',
  'order',
]);
function css(style) {
  return Object.entries(flatten(style))
    .filter(([, value]) => value != null)
    .map(([name, value]) => {
      if (name === 'flex') return 'flex:' + value + ' 1 0%';
      return (
        name.replace(/[A-Z]/g, c => '-' + c.toLowerCase()) +
        ':' +
        (typeof value === 'number' && !unitless.has(name)
          ? value + 'px'
          : value)
      );
    })
    .join(';');
}
function render(node, fontScale = 1) {
  if (node == null) return '';
  if (Array.isArray(node)) return node.map(child => render(child, fontScale)).join('');
  if (typeof node !== 'object') return escape(node);
  const props = node.props || {};
  if (node.type === 'Image' && props.source?.testUri?.endsWith('/venue.png')) {
    const icon = fs
      .readFileSync(
        path.join(__dirname, '../../../app/assets/icons/detail/venue.svg'),
        'utf8',
      )
      .replace(/stroke="#[^"]+"/g, 'stroke="currentColor"')
      .replace('<svg ', '<svg style="width:100%;height:100%" ');
    return (
      '<span aria-hidden="true" style="display:inline-flex;flex-shrink:0;' +
      escape(css(props.style) + ';color:' + flatten(props.style).tintColor) +
      '">' +
      icon +
      '</span>'
    );
  }
  const isText = node.type === 'Text';
  const style = { ...flatten(props.style) };
  if (isText && props.allowFontScaling !== false) {
    for (const key of ['fontSize', 'lineHeight']) {
      if (typeof style[key] === 'number') style[key] *= fontScale;
    }
  }
  const isButton =
    props.accessibilityRole === 'button' || props.accessibilityRole === 'link';
  const tag = isButton ? 'button' : 'div';
  const defaults = isText
    ? 'min-width:0;white-space:pre-wrap;'
    : 'display:flex;flex-direction:column;position:relative;flex-shrink:0;border-style:solid;border-width:0;';
  return (
    '<' +
    tag +
    ' style="' +
    escape(defaults + css(style)) +
    '"' +
    (props.disabled ? ' disabled' : '') +
    '>' +
    render(node.children, fontScale) +
    '</' +
    tag +
    '>'
  );
}
const names = [
  'guest',
  'current',
  'last-known',
  'unavailable',
  'replacement',
  'narrow-current',
  'large-current',
];
const views = names
  .map(name => {
    const tree = JSON.parse(
      fs.readFileSync(path.join(dir, name + '.json'), 'utf8'),
    );
    return (
      '<section><h2>' +
      escape(name) +
      '</h2><div class="phone' +
      (name === 'large-current' ? ' large' : '') +
      '"' +
      (name === 'narrow-current' ? ' style="width:320px"' : '') +
      '>' +
      render(tree, name === 'large-current' ? 1.6 : 1) +
      '</div></section>'
    );
  })
  .join('');
const html =
  '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<title>Current crowding component preview</title><style>' +
  '*{box-sizing:border-box}body{margin:24px;background:#faf6f2;font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo",sans-serif;color:#171717}' +
  'h1{font-size:22px}h2{font-size:14px}p{max-width:800px;color:#615951}.board{display:flex;gap:24px;flex-wrap:wrap;align-items:flex-start}' +
  '.phone{width:390px;padding:0 20px 20px;background:white;border:1px solid #ddd4cd}.phone button{font:inherit;border:0;background:transparent;text-align:left;color:inherit}' +
  '@media(max-width:430px){body{margin:12px}.phone{width:calc(100vw - 24px)}}' +
  '</style><h1>Current crowding · implemented component states</h1>' +
  '<p>Actual component output with illustrative fixtures, converted to HTML. Not a running native screenshot; browser and native text/layout may differ. The card sits beneath existing venue facts in detail. Narrow/large fixtures use the component’s real responsive branch; CSS enlarges text approximately and cannot reproduce Android font scaling exactly. Footer dialogs require the running app. No history or payment controls.</p>' +
  '<div class="board">' +
  views +
  '</div></html>';
fs.writeFileSync(path.join(__dirname, 'app-current-crowding.html'), html);
