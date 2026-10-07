#!/usr/bin/env python3
"""Exercise manifest LVGL bindings, input, navigation, restoration and idle work."""
import argparse
import html
import json
from pathlib import Path
import re
import subprocess
import time
from urllib.request import Request, urlopen


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--image', required=True)
    parser.add_argument('--theme', choices=['retro', 'modern'], required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    container = subprocess.check_output(['docker', 'run', '--rm', '--init', '-d',
        '-p', '127.0.0.1::6080', args.image], text=True).strip()
    captures = []
    try:
        port = subprocess.check_output(['docker', 'port', container, '6080'], text=True).strip().rsplit(':', 1)[1]
        base = f'http://127.0.0.1:{port}'

        def request(path, data=None):
            req = Request(base + path, data=json.dumps(data).encode() if data is not None else None,
                headers={'Content-Type': 'application/json'} if data is not None else {})
            with urlopen(req, timeout=30) as response:
                return response.read()

        def logs():
            return subprocess.check_output(['docker', 'logs', container], stderr=subprocess.STDOUT, text=True)

        deadline = time.monotonic() + 40
        while 'Loaded LVGL runtime:' not in logs():
            if time.monotonic() >= deadline:
                raise RuntimeError('LVGL runtime failed to mount')
            time.sleep(0.2)

        def capture(name, screen=0):
            previous, stable = None, 0
            deadline = time.monotonic() + 20
            while time.monotonic() < deadline:
                state = json.loads(request('/api/state'))
                current = state['pixelHash']
                stable = stable + 1 if current == previous else 0
                previous = current
                if stable >= 4 and state['screen'] == screen:
                    filename = name + '.png'
                    (output / filename).write_bytes(request('/api/screenshot.png'))
                    captures.append(filename)
                    return current
                time.sleep(0.2)
            raise RuntimeError(f'{name}: display did not stabilize on screen {screen}')

        def tap(widget):
            state = json.loads(request('/api/state'))
            layout = json.loads(request('/layout.json'))
            target = next(w for w in layout['screens'][state['screen']]['widgets'] if w['id'] == widget)
            request('/api/tap', {'x': target['x'] + target['width'] // 2,
                'y': target['y'] + target['height'] // 2})

        initial = capture('01-initial')
        request('/api/drag', {'x': 125, 'y': 370, 'toX': 125, 'toY': 250, 'durationMs': 600})
        assert capture('02-release-outside') == initial, 'drag out of button dispatched an action'
        tap('toggle')
        on = capture('03-state-on')
        assert on != initial, 'HA binding/visibility did not update'
        tap('detail')
        detail = capture('04-detail', 1)
        assert detail != on
        tap('back')
        assert capture('05-back') == on, 'navigation did not preserve state'
        tap('detail')
        capture('05a-native-text-and-stacking', 1)
        tap('overlap-upper')
        assert capture('05b-overlap-topmost') == on, 'overlap did not target the visually topmost button'
        tap('detail')
        capture('05c-minimum-target', 1)
        # Outside the 16px object, inside LVGL's extended 48px touch target.
        request('/api/tap', {'x': 418, 'y': 273})
        assert capture('05d-minimum-target-back') == on, 'minimum extended click area did not dispatch'
        tap('toggle')
        assert capture('06-state-off-restored') == initial, 'conditional hide did not restore original pixels'
        for _ in range(5):
            tap('toggle')
            tap('toggle')
            tap('detail')
            tap('back')
        assert capture('07-repeat-restored') == initial
        # Two diagnostic samples after stabilization must show no additional
        # setters, flushes or subscriptions while the 50ms poll continues.
        time.sleep(5)
        text = logs()
        samples = re.findall(r'text=(\d+) visibility=(\d+) flushes=(\d+) bindings=(\d+)', text)
        assert len(samples) >= 2 and samples[-1] == samples[-2], 'idle runtime performed redraw work'
        assert samples[-1][3] == '1', 'binding subscription count changed'
        assert text.count('Mock service light.toggle') == 12, 'missing or duplicate HA service actions'
        (output / 'logs.txt').write_text(text)
        (output / 'results.json').write_text(json.dumps({'theme': args.theme, 'passed': True,
            'captures': captures, 'idleCounters': samples[-1]}, indent=2))
        figures = ''.join(f'<figure><img src="{name}" width="480" height="480"><figcaption>{html.escape(name)}</figcaption></figure>' for name in captures)
        (output / 'index.html').write_text('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">'
            '<title>LVGL runtime checks</title><style>body{background:#10141c;color:white;font:16px system-ui}'
            'main{display:flex;flex-wrap:wrap}figure{margin:12px}img{max-width:100%;height:auto}</style>'
            f'<h1>{args.theme}: LVGL runtime checks passed</h1><main>{figures}</main>')
        print(f'{args.theme}: bindings, visibility, input cancellation, navigation, repeated restoration and idle work passed')
    finally:
        subprocess.run(['docker', 'stop', container], check=True, stdout=subprocess.DEVNULL)


if __name__ == '__main__':
    main()
