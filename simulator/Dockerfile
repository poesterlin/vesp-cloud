FROM python:3.13-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends build-essential git libsdl2-dev pkg-config && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir esphome==2026.7.1
WORKDIR /config
ARG GENERATED_DIR=generated
COPY ${GENERATED_DIR}/ ./
RUN esphome compile simulator.yaml && \
    find .esphome -type f -executable \( -name program -o -name firmware \) -exec cp {} /simulator \; && test -x /simulator

FROM python:3.13-slim
RUN apt-get update && apt-get install -y --no-install-recommends libsdl2-2.0-0 xvfb x11vnc novnc websockify xdotool curl && rm -rf /var/lib/apt/lists/* && useradd -m simulator
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt
WORKDIR /app
COPY --from=build /simulator ./simulator
COPY --from=build /config/layout.json /usr/share/novnc/layout.json
COPY index.html /usr/share/novnc/index.html
COPY client.js style.css /usr/share/novnc/
COPY screenshots/gallery/ /usr/share/novnc/screenshots/
COPY gallery.html /usr/share/novnc/gallery.html
COPY server.py ./server.py
COPY start.sh ./start.sh
RUN printf 'ok\n' > /usr/share/novnc/health && chmod +x start.sh && mkdir -p /tmp/.X11-unix && chmod 1777 /tmp/.X11-unix
ENV DISPLAY=:99 SDL_RENDER_DRIVER=software
USER simulator
EXPOSE 6080
CMD ["./start.sh"]
