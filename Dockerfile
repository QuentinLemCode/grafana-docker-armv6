# syntax=docker/dockerfile:1.7
# Minimal linux/arm (v6-compatible) image running Grafana from the ARMv6 standalone tarball

FROM arm32v6/alpine:latest

ENV GRAFANA_HOME=/opt/grafana \
    GF_PATHS_DATA=/var/lib/grafana \
    GF_PATHS_LOGS=/var/log/grafana \
    GF_PATHS_PLUGINS=/var/lib/grafana/plugins \
    GF_PATHS_PROVISIONING=/etc/grafana/provisioning \
    GF_SECURITY_ADMIN_PASSWORD=admin \
    GF_SERVER_HTTP_PORT=3000

RUN set -eux; \
    apk add --no-cache ca-certificates tzdata tar fontconfig ttf-dejavu libstdc++ libgcc wget libc6-compat gcompat; \
    # Provide GLIBC-style loader path if the binary expects it
    ln -sf /lib/ld-musl-armhf.so.1 /lib/ld-linux-armhf.so.3 || true; \
    addgroup -S grafana && adduser -S -G grafana grafana; \
    mkdir -p "$GRAFANA_HOME" "$GF_PATHS_DATA" "$GF_PATHS_LOGS" "$GF_PATHS_PLUGINS" "$GF_PATHS_PROVISIONING"; \
    chown -R grafana:grafana "$GRAFANA_HOME" "$GF_PATHS_DATA" "$GF_PATHS_LOGS" "$GF_PATHS_PLUGINS" "$GF_PATHS_PROVISIONING"

# Copy in the downloaded tarball at build time (from local tmp/).
# Use COPY (not ADD) to avoid auto-extraction of tar archives.
ARG GRAFANA_TARBALL
COPY tmp/${GRAFANA_TARBALL} /tmp/

RUN set -eux; \
    cd /tmp; \
    tar -zxvf ${GRAFANA_TARBALL}; \
    dir=$(find . -maxdepth 1 -type d -name 'grafana*' | head -n1 | sed 's#^./##'); \
    mv "$dir" "$GRAFANA_HOME"; \
    chmod +x "$GRAFANA_HOME"/bin/grafana-server "$GRAFANA_HOME"/bin/grafana-cli || true; \
    # Remove docs to save space
    rm -f "$GRAFANA_HOME"/LICENSE "$GRAFANA_HOME"/NOTICE "$GRAFANA_HOME"/README.md || true; \
    rm -f "/tmp/${GRAFANA_TARBALL}"

EXPOSE 3000
USER grafana

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 CMD wget -qO- http://127.0.0.1:3000/ || exit 1

ENTRYPOINT ["/opt/grafana/bin/grafana-server"]
CMD ["--homepath=/opt/grafana", "--packaging=docker", "--config=/etc/grafana/grafana.ini"]
