#!/usr/bin/env python3
"""Verify reboot-only manifests against one unchanged simulator image."""
import argparse
import io
import json
import pathlib
import subprocess
import time
import urllib.request
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--image', required=True)
    parser.add_argument('--theme', choices=['retro', 'modern'], required=True)
    parser.add_argument('--output', type=pathlib.Path, required=True)
    parser.add_argument('--project', default='simulator/demo.json', help='Project embedded in the tested image')
    args = parser.parse_args()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    output.chmod(0o755)
    source = output / 'active.vespui'
    # Reverse the title: different pixels using the same firmware font glyphs.
    compiler = '''
import { compileUiManifest } from './web/packages/editor/src/lib/codegen/ui-manifest';
import { RETRO_THEME } from './web/packages/editor/src/lib/themes/retro';
import { MODERN_THEME } from './web/packages/editor/src/lib/themes/modern';
const project = await Bun.file(process.argv[3]).json();
project.theme = process.argv[1] === 'retro' ? RETRO_THEME : MODERN_THEME;
const title = project.dashboardPages[0].components[0];
title.text = [...title.text].reverse().join('');
const result = compileUiManifest(project);
if (!result.ok) throw Error(JSON.stringify(result.errors));
await Bun.write(process.argv[2], result.bytes);
'''
    candidate = output / 'candidate.vespui'
    subprocess.run(['bun', '-e', compiler, args.theme, str(candidate), args.project], cwd=ROOT, check=True)
    candidate.chmod(0o644)
    source.unlink(missing_ok=True)
    container = subprocess.check_output([
        'docker', 'run', '--rm', '--init', '-d', '-p', '127.0.0.1::6080',
        '-v', f'{output}:/boot-manifest:ro', '-e', 'VESPUI_MANIFEST_PATH=/boot-manifest/active.vespui',
        args.image,
    ], text=True).strip()
    try:
        port = subprocess.check_output(['docker', 'port', container, '6080'], text=True).strip().rsplit(':', 1)[1]
        url = f'http://127.0.0.1:{port}'

        def get(path):
            with urllib.request.urlopen(url + path, timeout=5) as response:
                return response.read()

        def capture(name):
            deadline = time.monotonic() + 30
            previous, stable = None, 0
            while time.monotonic() < deadline:
                try:
                    state = json.loads(get('/api/state'))
                    current = state.get('frameHash')
                    stable = stable + 1 if current and current == previous else 0
                    previous = current
                    if stable >= 4:
                        png = get('/api/screenshot.png')
                        (output / f'{name}.png').write_bytes(png)
                        return Image.open(io.BytesIO(png)).convert('RGB').tobytes()
                except (OSError, ValueError):
                    stable = 0
                time.sleep(0.2)
            raise RuntimeError('framebuffer did not settle')

        def reboot():
            request = urllib.request.Request(url + '/api/reset', data=b'{}', headers={'Content-Type': 'application/json'}, method='POST')
            with urllib.request.urlopen(request, timeout=15) as response:
                response.read()
            time.sleep(1)

        initial = capture('01-embedded')
        source.write_bytes(candidate.read_bytes())
        source.chmod(0o644)
        assert capture('02-staged') == initial, 'manifest changed UI before reboot'
        reboot()
        changed = capture('03-external')
        assert changed != initial, 'external manifest did not activate on reboot'
        assert 'Manifest source: external' in subprocess.check_output(['docker', 'logs', container], stderr=subprocess.STDOUT, text=True)
        source.write_bytes(b'corrupt')
        assert capture('04-corrupt-staged') == changed, 'corrupt staged bytes affected running UI'
        reboot()
        assert capture('05-invalid-fallback') == initial, 'invalid manifest did not restore embedded UI'
        source.unlink()
        reboot()
        assert capture('06-missing-fallback') == initial, 'missing manifest did not restore embedded UI'
        print(f'{args.theme}: reboot activation, staging isolation, invalid/missing fallback passed')
    finally:
        subprocess.run(['docker', 'stop', container], check=True, stdout=subprocess.DEVNULL)


if __name__ == '__main__':
    main()
