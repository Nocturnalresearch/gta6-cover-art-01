// Vice Cover Studio — wires the editor: photos, panels, caption, grade, sizes, export.
//
// The state is plain data; every change redraws the preview canvas through
// cover.js. Photos are read on the user's own machine (a file input, or the
// two free samples) and never uploaded anywhere. Export draws the same cover
// at full post size and downloads it as a PNG.
//
// A `?shot=` query sets up a fixed scene for a screenshot instead (shots.js).

import { drawCover, LAYOUTS, panelRects } from './cover.js';

/** The post sizes the app exports. */
const SIZES = {
  square: { label: '1080 × 1080', w: 1080, h: 1080 },
  portrait: { label: '1080 × 1350', w: 1080, h: 1350 },
  wide: { label: '1920 × 1080', w: 1920, h: 1080 },
};

/** The free sample photos shipped with the app. */
const SAMPLES = [
  { name: 'Pier', url: 'samples/pier.jpg' },
  { name: 'Boulevard', url: 'samples/boulevard.jpg' },
];

/** A panel's starting photo, zoom and pan, by panel index. */
function defaultPanel(i) {
  return { photo: i % SAMPLES.length, zoom: 1, ox: 0, oy: 0 };
}

const state = {
  layout: 'hero',
  panels: [defaultPanel(0), defaultPanel(1), defaultPanel(2)],
  caption: 'VICE CITY',
  subtitle: 'SUNSET HEIST',
  grade: 0.7,
  size: 'wide',
  selected: 0,
};

/** Loaded photos: { name, img } in the order the panel pickers list them. */
const photos = [];

const canvas = document.getElementById('preview');
const status = document.getElementById('status');
const panelList = document.getElementById('panel-list');
const photoList = document.getElementById('photo-list');
const layoutRow = document.getElementById('layout-row');
const sizeRow = document.getElementById('size-row');

/** The preview resolution: the export aspect, capped so the editor stays quick. */
function previewSize() {
  const size = SIZES[state.size];
  const scale = Math.min(1, 860 / Math.max(size.w, size.h));
  return { w: Math.round(size.w * scale), h: Math.round(size.h * scale) };
}

function redraw() {
  const { w, h } = previewSize();
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const imgs = photos.map((p) => p.img);
  drawCover(canvas, state, imgs);
  syncPanelControls();
}

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

/** Rebuilds the photo strip: samples first, then the user's uploads. */
function renderPhotos() {
  photoList.innerHTML = '';
  photos.forEach((photo, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'thumb';
    button.textContent = photo.name;
    button.title = `Use ${photo.name} in the selected panel`;
    button.addEventListener('click', () => {
      state.panels[state.selected].photo = i;
      redraw();
    });
    photoList.appendChild(button);
  });
}

/** Rebuilds the panel picker and the selected panel's sliders. */
function syncPanelControls() {
  const rects = panelRects(state.layout, canvas.width, canvas.height);
  panelList.innerHTML = '';
  rects.forEach((_, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `panel-pick${i === state.selected ? ' on' : ''}`;
    button.textContent = `Panel ${i + 1}`;
    button.addEventListener('click', () => {
      state.selected = i;
      redraw();
    });
    panelList.appendChild(button);
  });
  const panel = state.panels[state.selected];
  document.getElementById('zoom').value = String(panel.zoom);
  document.getElementById('pan-x').value = String(panel.ox);
  document.getElementById('pan-y').value = String(panel.oy);
  document.getElementById('zoom-val').textContent = `${Math.round(panel.zoom * 100)}%`;
  document.getElementById('pan-x-val').textContent = panel.ox.toFixed(2);
  document.getElementById('pan-y-val').textContent = panel.oy.toFixed(2);
}

/** Makes the panels array fit the current layout's panel count. */
function fitPanelsToLayout() {
  const count = LAYOUTS[state.layout].panels.length;
  while (state.panels.length < count) state.panels.push(defaultPanel(state.panels.length));
  state.panels.length = count;
  if (state.selected >= count) state.selected = 0;
}

/** Renders the layout and size buttons, marking the active one. */
function renderChoiceRows() {
  layoutRow.innerHTML = '';
  for (const [key, def] of Object.entries(LAYOUTS)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = state.layout === key ? 'on' : '';
    button.textContent = def.name;
    button.addEventListener('click', () => {
      state.layout = key;
      fitPanelsToLayout();
      redraw();
    });
    layoutRow.appendChild(button);
  }
  sizeRow.innerHTML = '';
  for (const [key, size] of Object.entries(SIZES)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = state.size === key ? 'on' : '';
    button.textContent = size.label;
    button.addEventListener('click', () => {
      state.size = key;
      redraw();
    });
    sizeRow.appendChild(button);
  }
}

/** Exports the cover at full post size and downloads it as a PNG. */
export function exportCover() {
  const size = SIZES[state.size];
  const off = document.createElement('canvas');
  off.width = size.w;
  off.height = size.h;
  drawCover(off, state, photos.map((p) => p.img));
  return new Promise((resolve) => {
    off.toBlob((blob) => {
      const a = document.createElement('a');
      const name = `cover-${size.w}x${size.h}.png`;
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      status.textContent = `Saved ${name}`;
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      resolve(blob);
    }, 'image/png');
  });
}

// Exposed for screenshots: the shot driver calls it and reads the PNG back.
window.__exportCover = exportCover;

/** Picks the panel under a point on the preview canvas, if any. */
function panelAt(clientX, clientY) {
  const box = canvas.getBoundingClientRect();
  const x = ((clientX - box.left) / box.width) * canvas.width;
  const y = ((clientY - box.top) / box.height) * canvas.height;
  const rects = panelRects(state.layout, canvas.width, canvas.height);
  for (let i = rects.length - 1; i >= 0; i--) {
    const r = rects[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}

// Drag on the preview to pan the selected panel's photo; click selects a panel.
let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  const hit = panelAt(e.clientX, e.clientY);
  if (hit < 0) return;
  state.selected = hit;
  drag = { x: e.clientX, y: e.clientY, ox: state.panels[hit].ox, oy: state.panels[hit].oy };
  canvas.setPointerCapture(e.pointerId);
  redraw();
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const box = canvas.getBoundingClientRect();
  const panel = state.panels[state.selected];
  panel.ox = Math.max(-1, Math.min(1, drag.ox + ((e.clientX - drag.x) / box.width) * 2));
  panel.oy = Math.max(-1, Math.min(1, drag.oy + ((e.clientY - drag.y) / box.height) * 2));
  redraw();
});
canvas.addEventListener('pointerup', () => {
  drag = null;
});

document.getElementById('upload').addEventListener('change', async (e) => {
  for (const file of e.target.files) {
    if (!file.type.startsWith('image/')) continue;
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      photos.push({ name: file.name.replace(/\.[^.]+$/, ''), img });
    } catch {
      // A file that is not a picture is skipped, the rest still load.
    }
  }
  renderPhotos();
  redraw();
});

document.getElementById('caption').addEventListener('input', (e) => {
  state.caption = e.target.value;
  redraw();
});
document.getElementById('subtitle').addEventListener('input', (e) => {
  state.subtitle = e.target.value;
  redraw();
});
document.getElementById('grade').addEventListener('input', (e) => {
  state.grade = Number(e.target.value) / 100;
  document.getElementById('grade-val').textContent = `${e.target.value}%`;
  redraw();
});
document.getElementById('zoom').addEventListener('input', (e) => {
  state.panels[state.selected].zoom = Number(e.target.value);
  redraw();
});
document.getElementById('pan-x').addEventListener('input', (e) => {
  state.panels[state.selected].ox = Number(e.target.value);
  redraw();
});
document.getElementById('pan-y').addEventListener('input', (e) => {
  state.panels[state.selected].oy = Number(e.target.value);
  redraw();
});
document.getElementById('export').addEventListener('click', () => {
  exportCover();
});

/** Loads the two sample photos, then draws the first cover. */
export async function boot() {
  for (const sample of SAMPLES) {
    try {
      const img = await loadImage(sample.url);
      photos.push({ name: sample.name, img });
    } catch {
      // A missing sample leaves the panel empty; the editor still works.
    }
  }
  renderPhotos();
  renderChoiceRows();
  // The caption font ships with the app; wait for it before the first paint.
  try {
    await document.fonts.load('100px Anton');
  } catch {
    // Falls back to a system sans; the cover still draws.
  }
  redraw();
  document.fonts.ready.then(redraw).catch(() => {});
}

const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  const { runShot } = await import('./shots.js');
  runShot(shot, new URLSearchParams(location.search), {
    boot,
    state,
    photos,
    redraw,
    loadImage,
    exportCover,
  });
} else {
  boot();
}
