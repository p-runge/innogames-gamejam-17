# Ollama plus the entrypoint script. The script is copied into the image rather
# than bind-mounted from the checkout because Coolify rewrites a relative bind
# mount to a host path it never populates: the repository only ever exists in
# the build container. Docker then creates a directory at the missing source,
# `sh` reads that directory instead of the script and exits 0 without output,
# and `restart: unless-stopped` turns it into a silent restart loop. A build
# context is resolved where the checkout actually is, so it holds in both
# environments.
FROM ollama/ollama:latest

COPY entrypoint.sh /entrypoint.sh

# Replaces the upstream entrypoint (`/bin/ollama`), which would otherwise read
# the path as an argument to the ollama CLI.
ENTRYPOINT ["/bin/sh", "/entrypoint.sh"]
