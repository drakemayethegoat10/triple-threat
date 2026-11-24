import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pack } from '../tools/single-file.mjs';
import { ASSETS, PACKED, MODEL_FILES, SOUNDS } from '../src/render/assets.js';

const INDEX = `<!doctype html><html><head>
<script type="importmap">
{ "imports": { "three": "./node_modules/three/build/three.webgpu.js" } }
</script>
</head><body>
<script type="module" src="./src/main.js"></script>
</body></html>
`;

// Writes a throwaway project into a temp directory: an index.html with the import map and the module script tag,
// an empty src/main.js, plus `files` ({ path: contents }, which may replace main.js). Returns its root.
// The list of assets always comes from the real src/render/assets.js, which the packer imports.
const roots = [];
function project(files) {
  const root = mkdtempSync(join(tmpdir(), 'triple-threat-pack-'));
  roots.push(root);
  for (const [path, contents] of Object.entries({ 'index.html': INDEX, 'src/main.js': 'export {};\n', ...files })) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), contents);
  }
  return root;
}
after(() => { for (const root of roots) rmSync(root, { recursive: true, force: true }); });

const assets = () => Object.fromEntries(ASSETS.map(path => [path, `stand-in for ${path}`]));
const scriptJson = (html, id) => JSON.parse(html.match(new RegExp(`<script type="application/json" id="${id}">([\\s\\S]*?)</script>`))[1]);
const modulesIn = html => scriptJson(html, 'modules');
const assetsIn = html => scriptJson(html, 'assets');

test('pack follows relative, three and three/addons imports', () => {
  const root = project({
    'src/main.js': "import './a.js';\nimport * as THREE from 'three';\nimport { X } from 'three/addons/loaders/X.js';\n",
    'src/a.js': 'export const a = 1;\n',
    'node_modules/three/build/three.webgpu.js': 'export const T = 1;\n',
    'node_modules/three/examples/jsm/loaders/X.js': "import { T } from 'three';\nexport const X = T;\n",
    ...assets(),
  });
  const html = pack(root);
  const paths = modulesIn(html).map(([path]) => path);
  assert.deepEqual(paths, ['src/a.js', 'node_modules/three/build/three.webgpu.js', 'node_modules/three/examples/jsm/loaders/X.js', 'src/main.js']);
  assert.doesNotMatch(html, /importmap|src="\.\/src\/main\.js"/);
});

test('pack embeds every asset, byte for byte', () => {
  const bytes = Buffer.from([0, 1, 2, 250, 251, 60, 47]);          // includes "<" and "/"
  const root = project({ ...assets(), 'assets/players.glb': bytes, 'assets/floor/wood_floor_diff_2k.jpg': bytes });
  const packed = assetsIn(pack(root));
  assert.deepEqual(Object.keys(packed), [...PACKED]);
  assert.ok(MODEL_FILES.every(path => !(path in packed)), 'a league player\'s model is packed');
  assert.equal(Object.keys(packed).length, 6 + SOUNDS.length + 6 + 13 + MODEL_FILES.length);
  for (const model of MODEL_FILES) {
    const portrait = model.replace('/players/', '/portraits/').replace('.glb', '.webp');
    assert.equal(Buffer.from(packed[portrait], 'base64').toString(), `stand-in for ${portrait}`);
  }
  assert.deepEqual(Buffer.from(packed['assets/players.glb'], 'base64'), bytes);
  assert.deepEqual(Buffer.from(packed['assets/floor/wood_floor_diff_2k.jpg'], 'base64'), bytes);
});

test('pack refuses to build without a model file, and names it', () => {
  const files = assets(); delete files['assets/motion.glb'];
  assert.throws(() => pack(project(files)), /assets\/motion\.glb/);
});

test('the loader hands the packed files to the game before it starts', () => {
  const html = pack(project(assets()));
  assert.ok(html.includes('TT_ASSETS'), 'the loader never sets TT_ASSETS');
  assert.ok(html.indexOf('TT_ASSETS') < html.indexOf("import(urls['src/main.js'])"));
});

// An import or re-export statement that starts a line and whose first quoted name is still a relative path or three.
// Not the packer's own pattern: it runs on to the statement's first quote, so it also sees the imports that span lines
// (GLTFLoader's does) and any form the packer does not know. Three's comments show imports too, but never at the start of a line.
const BY_PATH = /^(?:import|export)\b[^'";]*['"](?:\.{1,2}\/|three)/m;

test('in the real game no import is left pointing at a file', () => {
  const modules = modulesIn(pack('.'));
  assert.ok(modules.some(([path]) => path === 'node_modules/three/examples/jsm/loaders/GLTFLoader.js'), 'the real game was not packed');
  for (const [path, source] of modules) {
    assert.equal(BY_PATH.test(source), false, `${path} still imports by path`);
  }
});
