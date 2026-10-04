"""Collect every widget-gallery page from a running simulator or Docker image.

Uses only the Python standard library. Image mode starts a temporary localhost
container and removes it afterward; it never deploys the build.
"""
import argparse
import html
import json
import os
import re
import struct
import subprocess
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen


def collect(base, output, build, timeout, settle):
    def get(path, data=None):
        request = Request(base.rstrip('/') + path,
                          data=json.dumps(data).encode() if data is not None else None,
                          headers={'Content-Type': 'application/json'})
        with urlopen(request, timeout=30) as response:
            return response.read()

    deadline = time.monotonic() + timeout
    while True:
        try:
            get('/health')
            break
        except (OSError, TimeoutError):
            if time.monotonic() >= deadline:
                raise RuntimeError(f'Simulator did not become healthy within {timeout}s: {base}')
            time.sleep(0.5)

    layout = json.loads(get('/layout.json'))
    pages = layout['screens']
    if not pages or any(not any(w['id'] == 'next' for w in page['widgets']) for page in pages):
        raise RuntimeError('This build is not a widget gallery: every page must provide a next target')
    # Reset the device only after establishing that it is a gallery build.
    get('/api/reset', {'settleMs': settle})
    output.mkdir(parents=True, exist_ok=True)
    captures = []
    def wait_for_stable_frame():
        if not layout.get('deterministic'):
            return
        deadline = time.monotonic() + 15
        previous, consecutive = None, 0
        while time.monotonic() < deadline:
            current = json.loads(get('/api/state'))['frameHash']
            consecutive = consecutive + 1 if current == previous else 0
            if consecutive >= 3:
                return
            previous = current
            time.sleep(0.15)
        raise RuntimeError('Deterministic device pixels did not settle within 15s')

    def capture(index, page, suffix=''):
        wait_for_stable_frame()
        slug = re.sub(r'[^a-zA-Z0-9_-]+', '-', page['id']).strip('-') or 'page'
        filename = f'{index + 1:02d}-{slug}{suffix}.png'
        png = get('/api/screenshot.png')
        if png[:8] != b'\x89PNG\r\n\x1a\n' or struct.unpack('>II', png[16:24]) != (layout['width'], layout['height']):
            raise RuntimeError(f'Invalid native PNG for {page["id"]}')
        (output / filename).write_bytes(png)
        captures.append({'page': index, 'id': page['id'] + suffix, 'name': page['name'] + suffix, 'file': filename})
        print(f'{page["name"]}{suffix}: {output / filename}', flush=True)
        return png
    for index, page in enumerate(pages):
        state = json.loads(get('/api/state'))
        if not state['ready'] or state['screen'] != index:
            raise RuntimeError(f'Expected ready page {index}, received {state}')
        initial = capture(index, page)
        scenarios = page.get('scenarios', []) if layout.get('deterministic') else []
        for scenario in scenarios:
            get('/api/' + scenario['operation'], {**scenario['data'], 'settleMs': settle})
            state = json.loads(get('/api/state'))
            if not state['ready'] or state['screen'] != index:
                raise RuntimeError(f'Scenario {scenario["id"]} left its expected page')
            frame = capture(index, page, '-' + scenario['id'])
            if scenario.get('expect') == 'initial' and frame != initial:
                raise RuntimeError(f'Scenario {scenario["id"]} did not restore the initial pixels')
            if scenario.get('expect') == 'changed' and frame == initial:
                raise RuntimeError(f'Scenario {scenario["id"]} produced no visible change')
        target = next(w for w in page['widgets'] if w['id'] == 'next')
        get('/api/tap', {'x': int(target['x'] + target['width'] / 2),
                         'y': int(target['y'] + target['height'] / 2), 'settleMs': settle})
    if json.loads(get('/api/state'))['screen'] != 0:
        raise RuntimeError('Gallery navigation did not wrap back to page zero')
    metadata = {'build': build, 'capturedAt': datetime.now(timezone.utc).isoformat(),
                'width': layout['width'], 'height': layout['height'], 'captures': captures,
                'theme': layout.get('theme'), 'deterministic': layout.get('deterministic', False),
                'renderer': layout.get('renderer', 'gallery')}
    (output / 'manifest.json').write_text(json.dumps(metadata, indent=2) + '\n')
    cards = ''.join(f'<figure><a href="{c["file"]}"><img src="{c["file"]}" alt="{html.escape(c["name"], quote=True)}" loading="lazy"></a><figcaption>{html.escape(c["name"])}</figcaption></figure>' for c in captures)
    (output / 'index.html').write_text('<!doctype html><html lang="en"><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        '<title>Build screenshots</title><style>body{background:#101820;color:#eee;font:16px system-ui;padding:20px}'
        'main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:20px}'
        'figure{margin:0}img{width:100%;max-width:480px;image-rendering:pixelated}figcaption{padding:10px 0}</style>'
        f'<h1>{html.escape(build or "Widget gallery")}</h1><p>Native device screenshots · {len(captures)} pages</p><main>{cards}</main></html>')
    print(f'Collected {len(captures)} captures. Gallery: {output / "index.html"}')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group()
    source.add_argument('--url', default=os.environ.get('SIMULATOR_URL', 'http://127.0.0.1:6086/'))
    source.add_argument('--image', help='Built Docker image; starts an isolated temporary simulator')
    parser.add_argument('--output', type=Path, default=Path(os.environ.get('GALLERY_OUTPUT', '/tmp/opencode/widget-gallery')))
    parser.add_argument('--build', help='Build label, e.g. retro or modern')
    parser.add_argument('--timeout', type=float, default=60, help='Startup timeout in seconds')
    parser.add_argument('--settle-ms', type=int, default=900, help='Wait after each page transition')
    args = parser.parse_args()
    if args.timeout <= 0 or not 0 <= args.settle_ms <= 5000:
        parser.error('timeout must be positive and settle-ms must be between 0 and 5000')
    container = None
    try:
        base = args.url
        build = args.build
        if args.image:
            image_id = subprocess.check_output(['docker', 'image', 'inspect', '--format', '{{.Id}}', args.image], text=True).strip()
            build = build or args.image
            container = 'vesp-capture-' + uuid.uuid4().hex[:12]
            subprocess.run(['docker', 'run', '--rm', '--init', '-d', '--name', container,
                            '-p', '127.0.0.1::6080', args.image], check=True, stdout=subprocess.DEVNULL)
            port = subprocess.check_output(['docker', 'port', container, '6080/tcp'], text=True).strip().split(':')[-1]
            base = f'http://127.0.0.1:{port}'
        collect(base, args.output, build, args.timeout, args.settle_ms)
        if args.image:
            manifest = args.output / 'manifest.json'
            data = json.loads(manifest.read_text())
            data['image'] = args.image
            data['imageId'] = image_id
            manifest.write_text(json.dumps(data, indent=2) + '\n')
    finally:
        if container:
            subprocess.run(['docker', 'rm', '-f', container], stdout=subprocess.DEVNULL, check=False)


if __name__ == '__main__':
    main()
