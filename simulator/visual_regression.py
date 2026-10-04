"""Two-theme firmware screenshot regression runner (local Docker only).

Requires Pillow: pip install Pillow==12.1.1
"""
import argparse
import html
import json
import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parent.parent


def compare(reference, candidate, destination):
    """Return exact changed-pixel count/bounds; PNG encoding is irrelevant."""
    with Image.open(reference) as before, Image.open(candidate) as after:
        before, after = before.convert('RGB'), after.convert('RGB')
        if before.size != after.size:
            destination.parent.mkdir(parents=True, exist_ok=True)
            Image.new('RGB', after.size, '#ff6040').save(destination)
            return {'status': 'dimensions', 'before': before.size, 'after': after.size}
        delta = ImageChops.difference(before, after)
        channels = delta.split()
        mask = ImageChops.lighter(ImageChops.lighter(channels[0], channels[1]), channels[2]).point(lambda p: 255 if p else 0)
        changed = mask.histogram()[255]
        bounds = mask.getbbox()
        visualization = after.point(lambda p: p // 4)
        visualization.paste(Image.new('RGB', after.size, '#ff6040'), mask=mask)
        destination.parent.mkdir(parents=True, exist_ok=True)
        visualization.save(destination)
        return {'status': 'changed' if changed else 'match', 'changedPixels': changed,
                'percent': changed * 100 / (after.width * after.height), 'bounds': bounds}


def compare_collection(reference, candidate, report, parity=False):
    expected = json.loads((reference / 'manifest.json').read_text())
    actual = json.loads((candidate / 'manifest.json').read_text())
    for field in ('theme', 'renderer', 'deterministic'):
        if field == 'renderer' and parity:
            continue
        if expected.get(field) != actual.get(field):
            raise RuntimeError(f'Incompatible collections: {field}: {expected.get(field)} != {actual.get(field)}')
    if not actual.get('deterministic'):
        raise RuntimeError('Regression comparison requires deterministic captures')
    before = {c['id']: c for c in expected['captures']}
    after = {c['id']: c for c in actual['captures']}
    results = []
    for key in sorted(before.keys() | after.keys()):
        row = {'id': key, 'name': (after.get(key) or before[key])['name']}
        if key not in before or key not in after:
            row['status'] = 'added' if key not in before else 'missing'
        else:
            filename = after[key]['file']
            report.mkdir(parents=True, exist_ok=True)
            for source, directory in ((reference / before[key]['file'], 'baseline'), (candidate / filename, 'candidate')):
                target = report / directory / filename
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, target)
            row.update(compare(reference / before[key]['file'], candidate / filename, report / 'diff' / filename))
            row['file'] = filename
        results.append(row)
    return results


def write_report(output, suites):
    failed = sum(row['status'] != 'match' for rows in suites.values() for row in rows)
    (output / 'results.json').write_text(json.dumps({'failed': failed, 'suites': suites}, indent=2) + '\n')
    sections = []
    for suite, rows in suites.items():
        cards = []
        for row in rows:
            images = ''
            if 'file' in row:
                images = ''.join(f'<div>{label}<a href="{suite}/{folder}/{row["file"]}"><img loading="lazy" src="{suite}/{folder}/{row["file"]}" alt="{label}"></a></div>'
                                 for folder, label in [('baseline', 'Baseline'), ('candidate', 'Candidate'), ('diff', 'Difference')])
            cards.append(f'<article><h3>{html.escape(row["name"])} — {row["status"]}</h3>'
                         f'<p>{row.get("changedPixels", "—")} changed pixels · bounds {row.get("bounds")}</p><div class="images">{images}</div></article>')
        sections.append(f'<h2>{html.escape(suite)}</h2>' + ''.join(cards))
    (output / 'index.html').write_text('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        '<title>Firmware visual regression</title><style>body{background:#101820;color:#eee;font:14px system-ui;padding:20px}'
        'article{border:1px solid #405060;padding:16px;margin:16px 0}.images{display:flex;flex-wrap:wrap;gap:16px}'
        '.images div{flex:1;min-width:240px;max-width:480px}img{display:block;width:100%;image-rendering:pixelated}</style>'
        f'<h1>Firmware visual regression: {failed} failures</h1>' + ''.join(sections) + '</html>')
    return failed


def run(command):
    subprocess.run(command, cwd=ROOT, check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--baseline', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=Path('/tmp/opencode/visual-regression'))
    parser.add_argument('--update-baseline', action='store_true', help='Explicitly create/replace baseline with current captures')
    parser.add_argument('--skip-build', action='store_true', help='Capture already-built vesp-regression images')
    parser.add_argument('--parity', action='store_true', help='Also compare generated and manifest renderers on the shared migration fixture')
    args = parser.parse_args()
    args.baseline, args.output = args.baseline.resolve(), args.output.resolve()
    if args.baseline == args.output or args.baseline in args.output.parents or args.output in args.baseline.parents:
        parser.error('baseline and output must be separate, non-nested directories')
    args.output.mkdir(parents=True, exist_ok=True)
    suites = {}
    for theme in ('retro', 'modern'):
        image = f'vesp-regression-{theme}'
        generated = f'simulator/generated/regression-{theme}'
        if not args.skip_build:
            run(['bun', 'run', 'simulator/generate.ts', '--gallery', '--deterministic', '--theme', theme, '--output', generated])
            log = args.output / f'{theme}-build.log'
            with log.open('w') as stream:
                subprocess.run(['docker', 'build', '--build-arg', f'GENERATED_DIR=generated/regression-{theme}', '-t', image, 'simulator'],
                               cwd=ROOT, stdout=stream, stderr=subprocess.STDOUT, check=True)
        captures = args.output / 'captures' / theme
        run([sys.executable, 'simulator/capture-gallery.py', '--image', image, '--build', theme, '--output', str(captures)])
        baseline = args.baseline / theme
        if args.update_baseline:
            baseline.mkdir(parents=True, exist_ok=True)
            for file in captures.iterdir():
                if file.is_file():
                    shutil.copy2(file, baseline / file.name)
        if not (baseline / 'manifest.json').exists():
            raise RuntimeError(f'No {theme} baseline. Use --update-baseline to explicitly establish it.')
        suites[theme] = compare_collection(baseline, captures, args.output / theme)
        if args.parity:
            for renderer in ('generated', 'manifest'):
                parity_image = f'vesp-parity-{theme}-{renderer}'
                generated = f'parity-{theme}-{renderer}'
                if not args.skip_build:
                    run(['bun', 'run', 'simulator/generate.ts', '--parity', renderer, '--deterministic', '--theme', theme,
                         '--output', f'simulator/generated/{generated}'])
                    with (args.output / f'{generated}-build.log').open('w') as stream:
                        subprocess.run(['docker', 'build', '--build-arg', f'GENERATED_DIR=generated/{generated}', '-t', parity_image, 'simulator'],
                                       cwd=ROOT, stdout=stream, stderr=subprocess.STDOUT, check=True)
                run([sys.executable, 'simulator/capture-gallery.py', '--image', parity_image, '--output', str(args.output / 'captures' / generated)])
            suite = f'{theme}-parity'
            suites[suite] = compare_collection(args.output / 'captures' / f'parity-{theme}-generated',
                                               args.output / 'captures' / f'parity-{theme}-manifest', args.output / suite, parity=True)
    failed = write_report(args.output, suites)
    print(f'{failed} failed cases. Report: {args.output / "index.html"}')
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
