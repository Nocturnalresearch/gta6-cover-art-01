// Fixed scenes for screenshots: ?shot=cover shows the cover alone, ?shot=editor
// shows the page with a sample photo loaded. The query picks the photo, the
// caption, the layout and the post size. window.__shotReady is set once the
// scene is painted, so the screenshot driver knows when to shoot.
//
//   ?shot=cover&photo=pier&caption=Sunset%20Heist&size=wide&layout=hero
//   ?shot=editor&photo=boulevard&caption=Boulevard%20Queen&size=portrait

/** Applies the scene's query to the editor state before it boots. */
function applyScene(query, api) {
  const photo = query.get('photo') ?? 'pier';
  const caption = query.get('caption');
  const subtitle = query.get('subtitle');
  const size = query.get('size');
  const layout = query.get('layout');
  const grade = query.get('grade');
  if (caption !== null) api.state.caption = caption;
  if (subtitle !== null) api.state.subtitle = subtitle;
  if (size && ['square', 'portrait', 'wide'].includes(size)) api.state.size = size;
  if (layout && ['hero', 'trio', 'quad'].includes(layout)) api.state.layout = layout;
  if (grade !== null && !Number.isNaN(Number(grade))) api.state.grade = Number(grade) / 100;
  // The chosen sample is the hero panel's photo; the others keep their defaults.
  const index = photo === 'boulevard' ? 1 : 0;
  api.state.panels.forEach((panel, i) => {
    panel.photo = i === 0 ? index : 1 - index;
  });
  // Each panel shows a different crop of its photo, so the panels never repeat.
  const crops = [
    { zoom: 1.0, ox: 0, oy: 0 },
    { zoom: 1.45, ox: -0.35, oy: 0.1 },
    { zoom: 1.7, ox: 0.4, oy: -0.15 },
    { zoom: 1.25, ox: 0.3, oy: 0.2 },
  ];
  api.state.panels.forEach((panel, i) => {
    const crop = crops[i] ?? crops[0];
    panel.zoom = crop.zoom;
    panel.ox = crop.ox;
    panel.oy = crop.oy;
  });
  return photo;
}

/** Marks the scene ready after two animation frames, so the paint has landed. */
function markReady() {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.__shotReady = true;
  }));
}

/**
 * Runs a shot scene: boots the editor with the scene's settings, then hides
 * the controls for a cover shot. `api` is the editor's boot/state/photos/
 * redraw/loadImage/exportCover bundle from main.js.
 */
export async function runShot(shot, query, api) {
  applyScene(query, api);
  if (shot === 'cover') document.body.classList.add('shot-cover');
  await api.boot();
  // The cover shot wants the cover at the scene's post size; the editor shot
  // keeps the editor chrome around the preview.
  if (shot === 'cover') {
    api.redraw();
  }
  markReady();
}
