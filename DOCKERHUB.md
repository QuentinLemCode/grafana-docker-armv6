# Grafana for Raspberry Pi (ARMv6)

Minimal Docker image of Grafana built from the official ARMv6 standalone binaries. Suitable for older Raspberry Pi devices (ARMv6).

- Base: Alpine (armv6)
- Grafana installed under `/opt/grafana`
- Exposes port `3000`
- Persistent data: `/var/lib/grafana`

## Quick start
```bash
docker run -d --name grafana \
  -p 3000:3000 \
  -v grafana-data:/var/lib/grafana \
  -e GF_SECURITY_ADMIN_PASSWORD=changeme \
  quentinlemcode/grafana-armv6
```

Then open `http://localhost:3000` (default login `admin/admin`).

## Environment variables
- `GF_SECURITY_ADMIN_PASSWORD`: admin password (default `admin`)
- `GF_SERVER_HTTP_PORT`: container HTTP port (default `3000`)
- `GF_PATHS_DATA`: data dir (default `/var/lib/grafana`)
- `GF_PATHS_LOGS`: logs dir (default `/var/log/grafana`)
- `GF_PATHS_PLUGINS`: plugins dir (default `/var/lib/grafana/plugins`)
- `GF_PATHS_PROVISIONING`: provisioning dir (default `/etc/grafana/provisioning`)

## Compose example
```yaml
services:
  grafana:
    image: quentinlemcode/grafana-armv6
    container_name: grafana
    ports:
      - "3000:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: "changeme"
    volumes:
      - grafana-data:/var/lib/grafana
    restart: unless-stopped

volumes:
  grafana-data:
```

## How this image is built
This repository scrapes the official Grafana downloads page to detect the latest ARMv6 Linux tarball and packages it into a `linux/arm/v6` image via GitHub Actions, pushing a new tag only when a new upstream version is detected.

Upstream: https://grafana.com/grafana/download?edition=oss&platform=arm

