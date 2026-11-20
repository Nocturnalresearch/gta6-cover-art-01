// Vice Cover Studio — the cover renderer.
//
// Draws a GTA-poster style cover onto any canvas: a Vice City sunset sky with a
// low sun and palm silhouettes, a skyline strip, white-bordered photo panels
// (one photo or several, each cropped and positioned on its own), a bold neon
// caption in the Anton typeface, and a warm sunset grade with a vignette.
// Everything is drawn from code and the photos the user loads: no Rockstar
// artwork, logo or font anywhere. The drawing is deterministic: the same
// state always paints the same pixels (a fixed-seed generator places the
// skyline and the palms).

/** A small deterministic generator (mulberry32) so the skyline and palms never move. */
export function seededRandom(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The panel layouts, as fractions of the cover (x, y, w, h), in order. */
export const LAYOUTS = {
  hero: {
    name: 'Hero + duo',
    panels: [
      [0.03, 0.03, 0.56, 0.62],
      [0.61, 0.03, 0.36, 0.30],
      [0.61, 0.35, 0.36, 0.30],
    ],
  },
  trio: {
    name: 'Trio',
    panels: [
      [0.03, 0.03, 0.31, 0.62],
      [0.345, 0.03, 0.31, 0.62],
      [0.66, 0.03, 0.31, 0.62],
    ],
  },
  quad: {
    name: 'Four panels',
    panels: [
      [0.03, 0.03, 0.465, 0.30],
      [0.505, 0.03, 0.465, 0.30],
      [0.03, 0.35, 0.465, 0.30],
      [0.505, 0.35, 0.465, 0.30],
    ],
  },
};

/** Where the skyline strip and the caption band sit, as fractions of height. */
const SKYLINE_TOP = 0.67;
const CAPTION_TOP = 0.80;

/** A panel's rectangle in pixels for a cover of W by H. */
export function panelRects(layout, W, H) {
  const def = LAYOUTS[layout] ?? LAYOUTS.hero;
  return def.panels.map(([fx, fy, fw, fh]) => ({
    x: fx * W,
    y: fy * H,
    w: fw * W,
    h: fh * H,
  }));
}

/** The sunset sky: purple up top, hot pink, then orange and gold at the horizon. */
function paintSky(ctx, W, H) {
  const sky = ctx.createLinearGradient(0, 0, 0, H * CAPTION_TOP);
  sky.addColorStop(0.0, '#2a0a4a');
  sky.addColorStop(0.35, '#7b1e6e');
  sky.addColorStop(0.62, '#e33e7a');
  sky.addColorStop(0.85, '#ff7a3d');
  sky.addColorStop(1.0, '#ffc93d');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H * CAPTION_TOP + 1);
  // The ground below the caption band stays dark so the lettering pops.
  ctx.fillStyle = '#160a24';
  ctx.fillRect(0, H * CAPTION_TOP, W, H * (1 - CAPTION_TOP));
}

/** The low sun and its glow, half-hidden behind the panels. */
function paintSun(ctx, W, H, rng) {
  const cx = W * (0.5 + (rng() - 0.5) * 0.1);
  const cy = H * 0.30;
  const r = Math.min(W, H) * 0.17;
  const glow = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 2.4);
  glow.addColorStop(0, 'rgba(255, 220, 130, 0.55)');
  glow.addColorStop(0.5, 'rgba(255, 120, 90, 0.18)');
  glow.addColorStop(1, 'rgba(255, 120, 90, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(cx - r * 2.4, cy - r * 2.4, r * 4.8, r * 4.8);
  const disc = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.3, r * 0.1, cx, cy, r);
  disc.addColorStop(0, '#fff6d8');
  disc.addColorStop(0.55, '#ffd76a');
  disc.addColorStop(1, '#ff8a3d');
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  // Thin haze bands across the sun.
  ctx.fillStyle = 'rgba(255, 122, 61, 0.35)';
  for (let i = 0; i < 3; i++) {
    const y = cy - r * 0.4 + i * r * 0.45;
    ctx.fillRect(cx - r, y, r * 2, Math.max(2, r * 0.07));
  }
}

/** A city skyline in silhouette across the strip above the caption band. */
function paintSkyline(ctx, W, H, rng) {
  const top = H * SKYLINE_TOP;
  const bottom = H * CAPTION_TOP;
  ctx.fillStyle = '#1a0b2e';
  let x = 0;
  while (x < W) {
    const bw = W * (0.03 + rng() * 0.055);
    const bh = (bottom - top) * (0.35 + rng() * 0.65);
    ctx.fillRect(x, bottom - bh, bw, bh);
    // A spire on some towers.
    if (rng() < 0.3) {
      ctx.fillRect(x + bw * 0.42, bottom - bh - (bottom - top) * 0.16, bw * 0.16, (bottom - top) * 0.16);
    }
    // A few lit windows.
    ctx.fillStyle = 'rgba(255, 214, 106, 0.85)';
    const lit = 1 + Math.floor(rng() * 4);
    for (let i = 0; i < lit; i++) {
      const wx = x + bw * (0.15 + rng() * 0.7);
      const wy = bottom - bh + (bottom - top) * (0.1 + rng() * 0.6);
      ctx.fillRect(wx, wy, Math.max(2, W * 0.004), Math.max(2, H * 0.006));
    }
    ctx.fillStyle = '#1a0b2e';
    x += bw + W * 0.004;
  }
}

/** One palm tree in silhouette: a leaning trunk and drooping fronds. */
function paintPalm(ctx, x, y, scale, lean, rng) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lean);
  ctx.scale(scale, scale);
  ctx.strokeStyle = '#160a24';
  ctx.fillStyle = '#160a24';
  ctx.lineCap = 'round';
  // Trunk, curving gently.
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(6, -60, -6, -118);
  ctx.stroke();
  // Fronds from the crown.
  const crownX = -6;
  const crownY = -118;
  for (let i = 0; i < 7; i++) {
    const angle = -Math.PI * (0.08 + (i / 6) * 0.84);
    const len = 62 + rng() * 26;
    const tipX = crownX + Math.cos(angle) * len;
    const tipY = crownY + Math.sin(angle) * len * 0.55 + 26;
    const midX = crownX + Math.cos(angle) * len * 0.55;
    const midY = crownY + Math.sin(angle) * len * 0.35 - 14;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(crownX, crownY);
    ctx.quadraticCurveTo(midX, midY, tipX, tipY);
    ctx.stroke();
  }
  ctx.restore();
}

/** Palms framing the cover at its left and right edges. */
function paintPalms(ctx, W, H, rng) {
  const s = Math.min(W, H) / 900;
  paintPalm(ctx, W * 0.015, H * 0.68, s * 1.15, -0.1, rng);
  paintPalm(ctx, W * 0.985, H * 0.68, s * 1.0, 0.12, rng);
  paintPalm(ctx, W * 0.06, H * 0.7, s * 0.6, 0.08, rng);
}

/** Draws one photo into a panel: cover-fit, zoomed, and panned by ox/oy (-1..1). */
function paintPanelPhoto(ctx, rect, photo, zoom, ox, oy) {
  const iw = photo.naturalWidth;
  const ih = photo.naturalHeight;
  if (!iw || !ih) return;
  const base = Math.max(rect.w / iw, rect.h / ih);
  const scale = base * Math.max(0.5, zoom);
  const pw = iw * scale;
  const ph = ih * scale;
  const slackX = Math.max(0, (pw - rect.w) / 2);
  const slackY = Math.max(0, (ph - rect.h) / 2);
  const dx = rect.x + (rect.w - pw) / 2 - ox * slackX;
  const dy = rect.y + (rect.h - ph) / 2 - oy * slackY;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.drawImage(photo, dx, dy, pw, ph);
  // A faint warm wash so the photo sits in the sunset.
  const wash = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  wash.addColorStop(0, 'rgba(255, 122, 61, 0.05)');
  wash.addColorStop(1, 'rgba(200, 40, 120, 0.12)');
  ctx.fillStyle = wash;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

/** A panel's white border and drop shadow. */
function paintPanelFrame(ctx, rect, W) {
  const border = Math.max(3, W * 0.008);
  ctx.save();
  ctx.shadowColor = 'rgba(10, 4, 20, 0.55)';
  ctx.shadowBlur = Math.max(6, W * 0.015);
  ctx.shadowOffsetY = Math.max(3, W * 0.006);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = border;
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
  // A thin neon edge on the border's inner side.
  ctx.strokeStyle = 'rgba(255, 46, 136, 0.55)';
  ctx.lineWidth = Math.max(1, W * 0.0015);
  ctx.strokeRect(rect.x + border, rect.y + border, rect.w - border * 2, rect.h - border * 2);
}

/** The big caption: Anton capitals with a black outline, a pink/cyan offset, and a warm gradient fill. */
function paintCaption(ctx, W, H, caption, subtitle) {
  const bandTop = H * CAPTION_TOP;
  const bandH = H - bandTop;
  // A neon rule above the lettering.
  const rule = ctx.createLinearGradient(W * 0.05, 0, W * 0.95, 0);
  rule.addColorStop(0, '#ff2e88');
  rule.addColorStop(0.5, '#ffd76a');
  rule.addColorStop(1, '#22d3ee');
  ctx.fillStyle = rule;
  ctx.fillRect(W * 0.05, bandTop + bandH * 0.06, W * 0.9, Math.max(2, H * 0.005));

  const text = (caption || 'VICE CITY').trim().toUpperCase();
  const maxW = W * 0.92;
  let size = bandH * 0.52;
  const setFont = () => {
    ctx.font = `${size}px Anton, "Arial Narrow", sans-serif`;
  };
  setFont();
  while (ctx.measureText(text).width > maxW && size > 10) {
    size -= 2;
    setFont();
  }
  const cx = W / 2;
  const baseline = bandTop + bandH * 0.58;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const off = Math.max(2, size * 0.035);
  // Chromatic offsets: cyan up-left, pink down-right.
  ctx.fillStyle = '#22d3ee';
  ctx.fillText(text, cx - off, baseline - off);
  ctx.fillStyle = '#ff2e88';
  ctx.fillText(text, cx + off, baseline + off);
  // The fill: white into warm gold.
  const fill = ctx.createLinearGradient(0, baseline - size, 0, baseline);
  fill.addColorStop(0, '#ffffff');
  fill.addColorStop(1, '#ffd76a');
  ctx.fillStyle = fill;
  ctx.lineWidth = Math.max(2, size * 0.07);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#12081f';
  ctx.strokeText(text, cx, baseline);
  ctx.fillText(text, cx, baseline);

  const sub = (subtitle || '').trim();
  if (sub) {
    const subSize = Math.max(10, bandH * 0.16);
    ctx.font = `700 ${subSize}px system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.fillText(sub.toUpperCase(), cx, bandTop + bandH * 0.88);
  }
}

/** The sunset grade: a warm wash, a neon tint at the edges, and a vignette. */
function paintGrade(ctx, W, H, strength) {
  const s = Math.max(0, Math.min(1, strength));
  if (s <= 0) return;
  const warm = ctx.createLinearGradient(0, 0, 0, H);
  warm.addColorStop(0, `rgba(255, 122, 61, ${0.05 * s})`);
  warm.addColorStop(1, `rgba(200, 40, 120, ${0.16 * s})`);
  ctx.fillStyle = warm;
  ctx.fillRect(0, 0, W, H);
  const vig = ctx.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.35, W / 2, H * 0.5, Math.max(W, H) * 0.75);
  vig.addColorStop(0, 'rgba(10, 4, 20, 0)');
  vig.addColorStop(1, `rgba(10, 4, 20, ${0.38 * s})`);
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
}

/**
 * Draws the whole cover onto `canvas` at its own size.
 * `state` is { layout, panels: [{photo, zoom, ox, oy}], caption, subtitle, grade }.
 * `photos` is an array of loaded images (or null entries) the panels index into.
 */
export function drawCover(canvas, state, photos) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const rng = seededRandom(20261120);
  ctx.clearRect(0, 0, W, H);
  paintSky(ctx, W, H);
  paintSun(ctx, W, H, rng);
  paintPalms(ctx, W, H, rng);
  const rects = panelRects(state.layout, W, H);
  rects.forEach((rect, i) => {
    const panel = state.panels[i] ?? { photo: 0, zoom: 1, ox: 0, oy: 0 };
    const photo = photos[panel.photo] ?? null;
    if (photo) paintPanelPhoto(ctx, rect, photo, panel.zoom, panel.ox, panel.oy);
    else {
      ctx.fillStyle = '#241533';
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
  });
  paintSkyline(ctx, W, H, rng);
  rects.forEach((rect) => paintPanelFrame(ctx, rect, W));
  paintCaption(ctx, W, H, state.caption, state.subtitle);
  paintGrade(ctx, W, H, state.grade);
}
