import RFB from './core/rfb.js';

const $ = (id) => document.getElementById(id);
const base = new URL('./', location.href);
const overlay = $('overlay');
const context = overlay.getContext('2d');
let rfb, point, layout, baseline, toastTimer;
let targetScreen = -1;

function toast(message) {
  $('message').textContent = message;
  $('message').style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('message').style.display = 'none'; }, 4000);
}

async function request(path, data) {
  const response = await fetch(new URL(path, base), data === undefined ? { cache: 'no-store' } : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(await response.text());
  return response;
}

function record(text) {
  const item = document.createElement('li');
  item.textContent = `${new Date().toLocaleTimeString()} · ${text}`;
  $('history').prepend(item);
  while ($('history').children.length > 10) $('history').lastChild.remove();
}

function drawOverlay() {
  context.clearRect(0, 0, 480, 480);
  if ($('grid').checked) {
    context.strokeStyle = '#8ab8e855'; context.fillStyle = '#c3ddff'; context.font = '11px monospace';
    for (let position = 0; position < 480; position += 60) {
      context.beginPath(); context.moveTo(position, 0); context.lineTo(position, 480);
      context.moveTo(0, position); context.lineTo(480, position); context.stroke();
      context.fillText(position, position + 3, 12);
      if (position) context.fillText(position, 3, position + 12);
    }
  }
  if (point) {
    context.strokeStyle = '#ffbd69'; context.lineWidth = 1;
    context.beginPath(); context.moveTo(point.x - 12, point.y); context.lineTo(point.x + 12, point.y);
    context.moveTo(point.x, point.y - 12); context.lineTo(point.x, point.y + 12); context.stroke();
  }
}

function pick(event, commit = false) {
  const box = $('screen').getBoundingClientRect();
  point = { x: Math.max(0, Math.min(479, Math.floor((event.clientX - box.left) * 480 / box.width))),
    y: Math.max(0, Math.min(479, Math.floor((event.clientY - box.top) * 480 / box.height))) };
  const canvas = $('screen').querySelector('canvas');
  let color = '';
  if (canvas?.width === 480) {
    const pixel = canvas.getContext('2d').getImageData(point.x, point.y, 1, 1).data;
    color = ` · #${[...pixel].slice(0, 3).map((value) => value.toString(16).padStart(2, '0')).join('')}`;
  }
  $('coordinates').textContent = `x ${point.x} · y ${point.y}${color}`;
  if (commit) { $('x').value = point.x; $('y').value = point.y; record(`Picked ${point.x}, ${point.y}`); }
  drawOverlay();
}

function updateTargets(state) {
  if (!layout) return;
  if (state.screen === targetScreen) return;
  targetScreen = state.screen;
  const screen = layout.screens[state.screen];
  $('screen-name').textContent = screen ? `${screen.name} · screen ${state.screen}` : '';
  $('targets').replaceChildren();
  for (const widget of screen?.widgets.filter((widget) => widget.type === 'button') ?? []) {
    const button = document.createElement('button');
    button.textContent = widget.label || widget.id;
    const caption = document.createElement('small');
    const x = Math.floor(widget.x + widget.width / 2), y = Math.floor(widget.y + widget.height / 2);
    caption.textContent = `${widget.id} · (${x}, ${y})`;
    button.append(caption);
    button.onclick = () => run(button, () => simulator.tapWidget(widget.id));
    $('targets').append(button);
  }
}

async function interact(operation, data) {
  const state = await (await request(`api/${operation}`, data)).json();
  if (window.simulatorConnected) await simulator.waitForDisplay(state);
  if (operation === 'reset') point = null;
  if (state.lastPointer) point = { x: state.lastPointer[0], y: state.lastPointer[1] };
  record(operation === 'reset' ? 'Reset device + mock state' : `${operation} (${data.x}, ${data.y})${operation === 'drag' ? ` → (${data.toX}, ${data.toY})` : ''}`);
  drawOverlay(); updateTargets(state);
  return state;
}

function connect() {
  if (rfb) rfb.disconnect();
  $('status').textContent = 'Connecting…';
  const url = new URL('websockify', base); url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const connection = new RFB($('screen'), url.toString());
  rfb = connection;
  rfb.scaleViewport = true; rfb.resizeSession = false; rfb.viewOnly = false; rfb.showDotCursor = false;
  connection.addEventListener('connect', () => {
    if (connection !== rfb) return;
    $('status').textContent = 'Connected · touch enabled'; window.simulatorConnected = true;
  });
  connection.addEventListener('disconnect', () => {
    if (connection !== rfb) return;
    $('status').textContent = 'Disconnected · reconnect to resume'; window.simulatorConnected = false;
  });
}

async function imagePixels(blob) {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas'); canvas.width = 480; canvas.height = 480;
  canvas.getContext('2d').drawImage(bitmap, 0, 0); bitmap.close();
  return canvas.getContext('2d').getImageData(0, 0, 480, 480);
}

export const simulator = window.simulator = {
  state: async () => (await request('api/state')).json(),
  logs: async () => (await request('api/logs')).json(),
  tap: (x, y, options = {}) => interact('tap', { x, y, ...options }),
  drag: (x, y, toX, toY, options = {}) => interact('drag', { x, y, toX, toY, ...options }),
  reset: () => interact('reset', {}),
  screenshot: async ({ grid = false, pointer = false } = {}) => (await request(`api/screenshot.png?grid=${Number(grid)}&pointer=${Number(pointer)}${pointer && point ? `&x=${point.x}&y=${point.y}` : ''}`)).blob(),
  screenshotDataUrl: async (options = {}) => {
    const blob = await simulator.screenshot(options);
    return new Promise((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob);
    });
  },
  waitForFrameChange: async (hash, timeoutMs = 5000) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const state = await simulator.state();
      if (state.frameHash !== hash) return state;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error('Timed out waiting for device pixels to change');
  },
  waitForDisplay: async (state = null, timeoutMs = 10000) => {
    state ??= await simulator.state();
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const canvas = $('screen').querySelector('canvas');
      if (canvas?.width === 480 && canvas.height === 480) {
        const pixels = canvas.getContext('2d').getImageData(0, 0, 480, 480).data;
        const digest = await crypto.subtle.digest('SHA-256', pixels);
        const hash = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
        if (hash === state.pixelHash) return state;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error('The streamed display has not caught up with the device pixels');
  },
  tapWidget: async (id) => {
    const state = await simulator.state();
    const widget = layout?.screens[state.screen]?.widgets.find((widget) => widget.id === id);
    if (!widget) throw new Error(`Widget '${id}' is not on the active screen`);
    return simulator.tap(Math.floor(widget.x + widget.width / 2), Math.floor(widget.y + widget.height / 2));
  },
  reconnect: connect,
};

async function saveScreenshot(annotated = false) {
  const blob = await simulator.screenshot({ grid: annotated, pointer: annotated });
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = `vesp-${annotated ? 'annotated-' : ''}${Date.now()}.png`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000); record('Saved native 480×480 PNG');
}

async function run(button, action) {
  button.disabled = true;
  try { return await action(); } catch (error) { toast(error.message); } finally { button.disabled = false; }
}

$('screen').addEventListener('pointermove', (event) => pick(event));
overlay.addEventListener('pointermove', (event) => pick(event));
overlay.addEventListener('pointerdown', (event) => { event.preventDefault(); pick(event, true); });
$('inspect').onchange = () => { overlay.classList.toggle('picking', $('inspect').checked); };
$('grid').onchange = drawOverlay;
$('tap-form').onsubmit = (event) => { event.preventDefault(); run(event.submitter, () => simulator.tap(Number($('x').value), Number($('y').value))); };
$('drag-form').onsubmit = (event) => { event.preventDefault(); run(event.submitter, () => simulator.drag(Number($('x').value), Number($('y').value), Number($('to-x').value), Number($('to-y').value))); };
$('screenshot').onclick = () => run($('screenshot'), () => saveScreenshot());
$('annotated').onclick = () => run($('annotated'), () => saveScreenshot(true));
$('reset').onclick = () => run($('reset'), () => simulator.reset());
$('reconnect').onclick = connect;
$('baseline').onclick = () => run($('baseline'), async () => {
  baseline = await imagePixels(await simulator.screenshot());
  $('comparison').textContent = 'Baseline saved. Interact, then compare to see exactly which pixels changed.';
});
$('compare').onclick = () => run($('compare'), async () => {
  if (!baseline) throw new Error('Set a baseline first');
  const current = await imagePixels(await simulator.screenshot());
  let changed = 0, minX = 480, minY = 480, maxX = -1, maxY = -1;
  const diff = new ImageData(480, 480);
  for (let index = 0; index < current.data.length; index += 4) {
    const different = current.data[index] !== baseline.data[index] || current.data[index + 1] !== baseline.data[index + 1] || current.data[index + 2] !== baseline.data[index + 2];
    const x = (index / 4) % 480, y = Math.floor(index / 4 / 480);
    if (different) { changed++; minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
    diff.data.set(different ? [255, 110, 80, 255] : [current.data[index] / 4, current.data[index + 1] / 4, current.data[index + 2] / 4, 255], index);
  }
  const canvas = document.createElement('canvas'); canvas.width = 480; canvas.height = 480; canvas.getContext('2d').putImageData(diff, 0, 0);
  $('diff-preview').src = canvas.toDataURL(); $('diff-preview').hidden = false;
  $('comparison').textContent = `${changed.toLocaleString()} changed pixels (${(changed / 2304).toFixed(2)}%)${changed ? ` · bounds ${minX},${minY} → ${maxX},${maxY}` : ' · exact match'}`;
});
$('refresh-logs').onclick = () => run($('refresh-logs'), async () => { $('logs').textContent = (await simulator.logs()).lines.join('\n'); });
document.addEventListener('keydown', (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey || event.target.matches('input,textarea,[contenteditable]')) return;
  if (event.key.toLowerCase() === 's') $('screenshot').click();
  else if (event.key.toLowerCase() === 'b') $('baseline').click();
  else if (event.key.toLowerCase() === 'g') { $('grid').checked = !$('grid').checked; drawOverlay(); }
  else if (event.key.toLowerCase() === 'i') { $('inspect').checked = !$('inspect').checked; $('inspect').onchange(); }
});
connect();
try { layout = await (await request('layout.json')).json(); updateTargets(await simulator.state()); } catch (error) { toast(error.message); }
// Direct touches may change screens outside the action API.
setInterval(async () => { try { updateTargets(await simulator.state()); } catch {} }, 2000);
