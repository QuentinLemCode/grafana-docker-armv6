# syntax=docker/dockerfile:1.7
# Minimal linux/arm (v6-compatible) image running Grafana from the ARMv6 standalone tarball

FROM arm32v6/debian:bullseye-slim

ENV GRAFANA_HOME=/opt/grafana \
    GF_PATHS_DATA=/var/lib/grafana \
    GF_PATHS_LOGS=/var/log/grafana \
    GF_PATHS_PLUGINS=/var/lib/grafana/plugins \
    GF_PATHS_PROVISIONING=/etc/grafana/provisioning \
    GF_SECURITY_ADMIN_PASSWORD=admin \
    GF_SERVER_HTTP_PORT=3000

RUN set -eux; \
    apt-get update; \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      ca-certificates tzdata curl wget libfontconfig1 fonts-dejavu-core tar; \
    rm -rf /var/lib/apt/lists/*; \
    addgroup --system grafana; \
    adduser --system --ingroup grafana --no-create-home --home /nonexistent grafana; \
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
    ln -sf "$GRAFANA_HOME"/bin/grafana-server /usr/local/bin/grafana-server; \
    ln -sf "$GRAFANA_HOME"/bin/grafana-cli /usr/local/bin/grafana-cli; \
    rm -f "/tmp/${GRAFANA_TARBALL}"

EXPOSE 3000
USER grafana

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 CMD curl -sf http://127.0.0.1:3000/ || exit 1

ENTRYPOINT ["/opt/grafana/bin/grafana-server"]
CMD ["--homepath=/opt/grafana", "--packaging=docker", "--config=/etc/grafana/grafana.ini"]
