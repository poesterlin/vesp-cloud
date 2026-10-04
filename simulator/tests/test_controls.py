"""Integration checks against an isolated running simulator, not the live demo.

SIMULATOR_URL=http://127.0.0.1:6085/ python3 -m unittest discover -s simulator/tests
"""
import json
import os
import struct
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen

BASE = os.environ.get('SIMULATOR_URL', 'http://127.0.0.1:6085/').rstrip('/')


def request(path, data=None, headers=None):
    body = json.dumps(data).encode() if data is not None else None
    with urlopen(Request(BASE + path, data=body, headers=headers or {'Content-Type': 'application/json'}), timeout=30) as response:
        return response.read()


def api(path, data=None):
    return json.loads(request('/api/' + path, data))


class SimulatorControlsTest(unittest.TestCase):
    def setUp(self):
        api('reset', {})

    def test_ready_and_native_png(self):
        state = api('state')
        self.assertTrue(state['ready'])
        self.assertEqual(state['screen'], 0)
        png = request('/api/screenshot.png')
        self.assertEqual(png[:8], b'\x89PNG\r\n\x1a\n')
        self.assertEqual(struct.unpack('>II', png[16:24]), (480, 480))

    def test_tap_changes_state_and_reset_restores_exact_pixels(self):
        original = api('state')['frameHash']
        toggled = api('tap', {'x': 350, 'y': 198})
        self.assertNotEqual(toggled['frameHash'], original)
        self.assertEqual(toggled['lastPointer'], [350, 198])
        self.assertTrue(any('light.demo = on' in line for line in api('logs')['lines']))
        self.assertEqual(api('reset', {})['frameHash'], original)

    def test_repeated_taps_restore_background(self):
        original = api('state')['frameHash']
        api('tap', {'x': 350, 'y': 198})
        self.assertEqual(api('tap', {'x': 350, 'y': 198})['frameHash'], original)

    def test_screen_navigation_and_back(self):
        self.assertEqual(api('tap', {'x': 230, 'y': 342})['screen'], 1)
        self.assertEqual(api('tap', {'x': 230, 'y': 342})['screen'], 0)

    def test_drag_does_not_become_a_tap(self):
        original = api('state')['frameHash']
        result = api('drag', {'x': 350, 'y': 198, 'toX': 350, 'toY': 100, 'durationMs': 300})
        self.assertEqual(result['lastPointer'], [350, 100])
        self.assertEqual(result['frameHash'], original)

    def test_annotated_capture_is_separate_from_device_pixels(self):
        plain = request('/api/screenshot.png')
        self.assertNotEqual(plain, request('/api/screenshot.png?grid=1'))
        self.assertEqual(plain, request('/api/screenshot.png'))

    def test_invalid_coordinates_never_mutate(self):
        original = api('state')['frameHash']
        for value in (-1, 480, True, 1.5, '120'):
            with self.assertRaises(HTTPError) as result:
                api('tap', {'x': value, 'y': 198})
            self.assertEqual(result.exception.code, 400)
        self.assertEqual(api('state')['frameHash'], original)

    def test_cross_origin_and_oversized_controls_rejected(self):
        with self.assertRaises(HTTPError) as result:
            request('/api/reset', {}, {'Content-Type': 'application/json', 'Origin': 'https://another.example'})
        self.assertEqual(result.exception.code, 403)
        with self.assertRaises(HTTPError) as result:
            api('tap', {'x': 350, 'y': 198, 'extra': 'x' * 5000})
        self.assertEqual(result.exception.code, 413)


if __name__ == '__main__':
    unittest.main()
