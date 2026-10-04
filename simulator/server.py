"""Simulator controls, PNG capture, device supervision and noVNC gateway."""
import asyncio
import hashlib
import io
import json
import re
from collections import deque
from pathlib import Path
from urllib.parse import urlsplit

from aiohttp import ClientSession, WSMsgType, web
from PIL import Image, ImageDraw
from Xlib import X, display

ROOT = Path('/usr/share/novnc')
WIDTH = HEIGHT = 480
logs = deque(maxlen=300)
process = None
reader_task = None
ready = asyncio.Event()
actions = asyncio.Lock()
last_pointer = None
started_at = None
current_screen = 0


async def read_logs(stream):
    global current_screen
    while line := await stream.readline():
        text = re.sub(r'\x1b\[[0-9;]*m', '', line.decode(errors='replace').rstrip())
        logs.append(text)
        if match := re.search(r'Screen changed: (\d+)', text):
            current_screen = int(match.group(1))
        print(text, flush=True)
        if 'setup() finished successfully!' in text:
            ready.set()


async def start_device():
    global process, reader_task, started_at, current_screen
    current_screen = 0
    ready.clear()
    started_at = asyncio.get_running_loop().time()
    process = await asyncio.create_subprocess_exec(
        'stdbuf', '-oL', '-eL', '/app/simulator',
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT)
    reader_task = asyncio.create_task(read_logs(process.stdout))
    await asyncio.wait_for(ready.wait(), 15)


async def stop_device():
    if process and process.returncode is None:
        process.terminate()
        try:
            await asyncio.wait_for(process.wait(), 5)
        except TimeoutError:
            process.kill()
            await process.wait()
    if reader_task:
        await reader_task


def capture(grid=False, pointer=None):
    connection = display.Display()
    try:
        pixels = connection.screen().root.get_image(0, 0, WIDTH, HEIGHT, X.ZPixmap, 0xffffffff)
        image = Image.frombytes('RGB', (WIDTH, HEIGHT), pixels.data, 'raw', 'BGRX')
    finally:
        connection.close()
    draw = ImageDraw.Draw(image)
    if grid:
        for position in range(0, WIDTH, 60):
            draw.line((position, 0, position, HEIGHT), fill='#607b99')
            draw.line((0, position, WIDTH, position), fill='#607b99')
            draw.text((position + 3, 3), str(position), fill='white')
            if position:
                draw.text((3, position + 3), str(position), fill='white')
    if pointer:
        x, y = pointer
        draw.line((x - 12, y, x + 12, y), fill='#ffbd69', width=2)
        draw.line((x, y - 12, x, y + 12), fill='#ffbd69', width=2)
        draw.text((min(x + 8, 395), min(y + 8, 460)), f'{x}, {y}', fill='#ffbd69')
    output = io.BytesIO()
    image.save(output, format='PNG')
    return output.getvalue()


def integer(data, key, minimum, maximum, default=None):
    value = data.get(key, default)
    if isinstance(value, bool) or not isinstance(value, int) or not minimum <= value <= maximum:
        raise web.HTTPBadRequest(text=f'{key} must be an integer from {minimum} to {maximum}')
    return value


async def command(*args):
    child = await asyncio.create_subprocess_exec('xdotool', *map(str, args), stderr=asyncio.subprocess.PIPE)
    _, error = await child.communicate()
    if child.returncode:
        raise RuntimeError(error.decode(errors='replace'))


@web.middleware
async def headers(request, handler):
    origin = request.headers.get('Origin')
    if request.method == 'POST' and origin and urlsplit(origin).netloc != request.host:
        raise web.HTTPForbidden(text='Cross-origin simulator control is not allowed')
    try:
        response = await handler(request)
    except web.HTTPException as error:
        response = error
    if request.path.startswith('/api/') or request.path == '/health':
        response.headers['Cache-Control'] = 'no-store'
    return response


async def health(request):
    return web.Response(text='ok\n', status=200 if process and process.returncode is None and ready.is_set() else 503)


async def state(request):
    frame = await asyncio.to_thread(capture)
    return web.json_response({
        'ready': ready.is_set() and process.returncode is None,
        'width': WIDTH, 'height': HEIGHT, 'lastPointer': last_pointer, 'screen': current_screen,
        'frameHash': hashlib.sha256(frame).hexdigest(), 'mockHomeAssistant': True,
        'pixelHash': hashlib.sha256(Image.open(io.BytesIO(frame)).convert('RGBA').tobytes()).hexdigest(),
        'uptimeSeconds': round(asyncio.get_running_loop().time() - started_at, 1),
    })


async def screenshot(request):
    pointer = last_pointer if request.query.get('pointer') == '1' else None
    if 'x' in request.query or 'y' in request.query:
        try:
            coordinates = {key: int(request.query[key]) for key in ('x', 'y')}
        except (ValueError, KeyError):
            raise web.HTTPBadRequest(text='Screenshot pointer requires integer x and y')
        pointer = [integer(coordinates, 'x', 0, 479), integer(coordinates, 'y', 0, 479)]
    png = await asyncio.to_thread(capture, request.query.get('grid') == '1', pointer)
    return web.Response(body=png, content_type='image/png')


async def get_logs(request):
    return web.json_response({'lines': list(logs)})


async def act(request):
    global last_pointer
    try:
        data = await request.json()
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise web.HTTPBadRequest(text='Expected a JSON object')
    if not isinstance(data, dict):
        raise web.HTTPBadRequest(text='Expected a JSON object')
    settle = integer(data, 'settleMs', 0, 5000, 450)
    operation = request.match_info['operation']
    if operation != 'reset':
        x = integer(data, 'x', 0, WIDTH - 1)
        y = integer(data, 'y', 0, HEIGHT - 1)
        duration = integer(data, 'durationMs', 40, 5000, 100 if operation == 'tap' else 500)
        end_x = integer(data, 'toX', 0, WIDTH - 1) if operation == 'drag' else x
        end_y = integer(data, 'toY', 0, HEIGHT - 1) if operation == 'drag' else y
    async with actions:
        if operation == 'reset':
            await stop_device()
            logs.clear()
            last_pointer = None
            await start_device()
        else:
            await command('mousemove', x, y)
            await command('mousedown', 1)
            try:
                steps = max(1, duration // 25)
                for step in range(1, steps + 1):
                    await asyncio.sleep(duration / steps / 1000)
                    if operation == 'drag':
                        await command('mousemove', round(x + (end_x - x) * step / steps),
                                      round(y + (end_y - y) * step / steps))
            finally:
                await command('mouseup', 1)
            last_pointer = [end_x, end_y]
        await asyncio.sleep(settle / 1000)
        return await state(request)


async def websocket(request):
    downstream = web.WebSocketResponse(max_msg_size=4 * 1024 * 1024)
    await downstream.prepare(request)
    async with ClientSession() as session:
        async with session.ws_connect('http://127.0.0.1:6081/', max_msg_size=4 * 1024 * 1024) as upstream:
            async def relay(source, destination):
                async for message in source:
                    if message.type == WSMsgType.BINARY:
                        await destination.send_bytes(message.data)
                    elif message.type == WSMsgType.TEXT:
                        await destination.send_str(message.data)
                    else:
                        break
                await destination.close()
            tasks = [asyncio.create_task(relay(downstream, upstream)), asyncio.create_task(relay(upstream, downstream))]
            try:
                await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
            finally:
                for task in tasks:
                    task.cancel()
                await asyncio.gather(*tasks, return_exceptions=True)
    return downstream


async def lifecycle(app):
    await start_device()
    try:
        yield
    finally:
        await stop_device()


app = web.Application(client_max_size=4096, middlewares=[headers])
app.cleanup_ctx.append(lifecycle)
app.router.add_get('/health', health)
app.router.add_get('/api/state', state)
app.router.add_get('/api/logs', get_logs)
app.router.add_get('/api/screenshot.png', screenshot)
app.router.add_post('/api/{operation:tap|drag|reset}', act)
app.router.add_get('/websockify', websocket)
app.router.add_get('/', lambda request: web.FileResponse(ROOT / 'index.html'))
app.router.add_static('/', ROOT, show_index=False)
if __name__ == '__main__':
    web.run_app(app, host='0.0.0.0', port=6080)
