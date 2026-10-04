"""Convenient simulator CLI. All coordinates are native 480x480 pixels."""
import argparse
import json
import os
from pathlib import Path
from urllib.request import Request, urlopen

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default=os.environ.get('SIMULATOR_URL', 'https://vesp.cloud/simulator/'), help='Simulator base URL (or SIMULATOR_URL)')
sub = parser.add_subparsers(dest='operation', required=True)
tap = sub.add_parser('tap')
tap.add_argument('x', type=int)
tap.add_argument('y', type=int)
widget = sub.add_parser('tap-widget')
widget.add_argument('id')
drag = sub.add_parser('drag')
for key in ('x', 'y', 'toX', 'toY'):
    drag.add_argument(key, type=int)
drag.add_argument('--duration', type=int, default=500)
shot = sub.add_parser('screenshot')
shot.add_argument('output', type=Path)
shot.add_argument('--grid', action='store_true')
shot.add_argument('--pointer', action='store_true')
for name in ('state', 'logs', 'reset'):
    sub.add_parser(name)
for name in ('tap', 'tap-widget', 'drag', 'reset'):
    sub.choices[name].add_argument('--capture', type=Path, help='Save a native PNG after the action')
args = parser.parse_args()
url = args.url.rstrip('/') + '/api/'
body = None
operation = args.operation
if operation == 'tap-widget':
    with urlopen(url + 'state', timeout=30) as response:
        screen = json.load(response)['screen']
    with urlopen(args.url.rstrip('/') + '/layout.json', timeout=30) as response:
        layout = json.load(response)
    target = next((item for item in layout['screens'][screen]['widgets'] if item['id'] == args.id), None)
    if not target:
        parser.error(f"Widget '{args.id}' is not on the active screen")
    args.x, args.y = target['x'] + target['width'] // 2, target['y'] + target['height'] // 2
    operation = 'tap'
if operation in ('tap', 'drag', 'reset'):
    data = {key: getattr(args, key) for key in ('x', 'y', 'toX', 'toY') if hasattr(args, key)}
    if args.operation == 'drag':
        data['durationMs'] = args.duration
    body = json.dumps(data).encode()
path = operation
if path == 'screenshot':
    path = f'screenshot.png?grid={int(args.grid)}&pointer={int(args.pointer)}'
request = Request(url + path, data=body, headers={'Content-Type': 'application/json'} if body else {})
with urlopen(request, timeout=30) as response:
    result = response.read()
if args.operation == 'screenshot':
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(result)
    print(args.output)
elif args.operation == 'logs':
    print('\n'.join(json.loads(result)['lines']))
else:
    print(json.dumps(json.loads(result), indent=2))
if getattr(args, 'capture', None):
    with urlopen(url + 'screenshot.png', timeout=30) as response:
        args.capture.parent.mkdir(parents=True, exist_ok=True)
        args.capture.write_bytes(response.read())
    print(args.capture)
