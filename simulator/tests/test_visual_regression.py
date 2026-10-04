"""Offline correctness checks for regression detection and collection coverage."""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

from PIL import Image

spec = importlib.util.spec_from_file_location('visual_regression', Path(__file__).resolve().parents[1] / 'visual_regression.py')
regression = importlib.util.module_from_spec(spec)
spec.loader.exec_module(regression)


class VisualRegressionTest(unittest.TestCase):
    def test_one_pixel_change_is_detected_with_exact_bounds(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            image = Image.new('RGB', (20, 20), 'black')
            image.save(root / 'before.png')
            image.putpixel((7, 11), (255, 0, 0))
            image.save(root / 'after.png')
            result = regression.compare(root / 'before.png', root / 'after.png', root / 'diff.png')
            self.assertEqual(result['status'], 'changed')
            self.assertEqual(result['changedPixels'], 1)
            self.assertEqual(result['bounds'], (7, 11, 8, 12))

    def test_encoding_difference_does_not_count_as_pixel_change(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            image = Image.new('RGB', (20, 20), '#123456')
            image.save(root / 'before.png', compress_level=0)
            image.save(root / 'after.png', compress_level=9)
            self.assertNotEqual((root / 'before.png').read_bytes(), (root / 'after.png').read_bytes())
            result = regression.compare(root / 'before.png', root / 'after.png', root / 'diff.png')
            self.assertEqual(result['status'], 'match')

    def test_missing_added_and_dimension_changes_fail(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name, captures in [('before', ['shared', 'removed']), ('after', ['shared', 'added'])]:
                folder = root / name
                folder.mkdir()
                manifest = {'theme': 'retro', 'renderer': 'gallery', 'deterministic': True,
                            'captures': [{'id': key, 'name': key, 'file': key + '.png'} for key in captures]}
                (folder / 'manifest.json').write_text(json.dumps(manifest))
                Image.new('RGB', (10 if name == 'before' else 11, 10)).save(folder / 'shared.png')
            rows = regression.compare_collection(root / 'before', root / 'after', root / 'report')
            self.assertEqual({row['status'] for row in rows}, {'dimensions', 'missing', 'added'})
            self.assertEqual(regression.write_report(root / 'report', {'retro': rows}), 3)

    def test_theme_mismatch_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for theme in ('retro', 'modern'):
                (root / theme).mkdir()
                (root / theme / 'manifest.json').write_text(json.dumps({'theme': theme}))
            with self.assertRaisesRegex(RuntimeError, 'theme'):
                regression.compare_collection(root / 'retro', root / 'modern', root / 'report')


if __name__ == '__main__':
    unittest.main()
