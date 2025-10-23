## Grafana Docker ARMv6

Builds and publishes a minimal Docker image of Grafana for Raspberry Pi (ARMv6). It scrapes the official downloads page to fetch the latest Standalone Linux Binaries for ARMv6, builds an image, and (optionally via GitHub Actions) pushes it to Docker Hub.

Source for downloads: [Grafana ARM downloads](https://grafana.com/grafana/download?edition=oss&platform=arm)

### Features
- Scraper using Playwright to discover the latest ARMv6 tarball URL
- Stores downloads in `tmp/` with `metadata.json`
- Dockerfile installs the tarball into `/opt/grafana`
- GitHub Actions workflow: weekly check, build only if new version, push to Docker Hub
- Node built-in test to verify the download works

### Requirements
- Node.js 20+
- Docker with Buildx
- QEMU (for building linux/arm/v6 on x86 hosts)

### Install
```bash
npm ci
npx playwright install --with-deps chromium
```

### Build the tooling
```bash
npm run build
```

### Discover latest version (JSON)
```bash
npm run check-latest
# => prints JSON like { "version": "12.2.1", "url": "https://...linux_arm-6.tar.gz" }
```

### Download latest ARMv6 tarball
```bash
npm run download
# => saves to tmp/<grafana_*_linux_arm-6.tar.gz> and writes tmp/metadata.json
```

### Run tests (download validation)
```bash
npm test
# Compiles, installs Playwright, runs node --test, and verifies the tarball exists and metadata is sane
```

### Build the Docker image (linux/arm/v6)
On x86, enable QEMU and Buildx first:
```bash
docker run --privileged --rm tonistiigi/binfmt:latest --install all
docker buildx create --use || true
```

Then build using the downloaded tarball from `tmp/`:
```bash
TAR=$(basename $(ls tmp/*.tar.gz))
docker buildx build \
  --platform linux/arm/v6 \
  --build-arg GRAFANA_TARBALL=$TAR \
  -t <your-dockerhub-user>/grafana-armv6:<version> \
  --load .
```

### Run the container
```bash
docker run -d --name grafana \
  -p 3000:3000 \
  -v grafana-data:/var/lib/grafana \
  -e GF_SECURITY_ADMIN_PASSWORD=changeme \
  <your-dockerhub-user>/grafana-armv6:<version>

# Open http://localhost:3000 (default admin/admin)
```

### GitHub Actions (weekly build on new version only)
Workflow: `/.github/workflows/weekly.yml`

Secrets required in the repository:
- `DOCKERHUB_USERNAME`: your Docker Hub username
- `DOCKERHUB_TOKEN`: a Docker Hub access token

What it does:
- Runs weekly (and on manual dispatch)
- Scrapes the latest version
- Skips build if the tag already exists on Docker Hub
- If new: downloads the tarball, builds for `linux/arm/v6`, and pushes `<version>` and `latest` tags to `DOCKERHUB_USERNAME/grafana-armv6`

### Notes
- `tmp/` is ignored by Git but included in the Docker build context (see `.dockerignore`), so the downloaded tarball can be `ADD`ed during the image build.
- The Dockerfile uses `arm32v6/alpine` and installs Grafana under `/opt/grafana`.
- You can customize Grafana via environment variables like `GF_SERVER_HTTP_PORT`, `GF_SECURITY_ADMIN_PASSWORD`, etc.

### Troubleshooting
- If Playwright fails due to missing system deps, run `npx playwright install --with-deps chromium`.
- If building on x86 and `linux/arm/v6` fails, ensure QEMU/binfmt and Buildx are set up as shown above.
- If `npm test` fails intermittently, re-run; it performs live network download.


