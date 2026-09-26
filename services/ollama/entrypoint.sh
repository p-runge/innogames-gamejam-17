#!/bin/sh
# Starts Ollama and makes sure the configured model is present, without ever
# letting a pull decide whether the container lives.
#
# Deliberately not `set -e`: with it, a failed `ollama pull` exits PID 1. That
# turns a transient registry outage — or a typo in LLM_MODEL — into a container
# that cannot start, which takes the whole game down even though the weights are
# already in the volume and the app has its own fallback for a silent model.
# A pull failure is logged and survived; the healthcheck reports whether the
# model is actually usable.

ollama serve &
serve_pid=$!

# Forwards SIGTERM so `ollama serve` shuts down on redeploy instead of being
# SIGKILLed after the grace period, which can leave a half-written blob in the
# named volume mid-pull.
trap 'kill -TERM "$serve_pid" 2>/dev/null; wait "$serve_pid"; exit 0' TERM INT

# `ollama serve` becomes ready some time after the process exists; `ollama list`
# is the cheapest call that fails until it is.
until ollama list >/dev/null 2>&1; do
  sleep 1
done

if ollama show "$LLM_MODEL" >/dev/null 2>&1; then
  echo "entrypoint: $LLM_MODEL already present, skipping pull"
elif ollama pull "$LLM_MODEL"; then
  echo "entrypoint: pulled $LLM_MODEL"
else
  echo "entrypoint: WARNING could not pull $LLM_MODEL; serving without it" >&2
fi

wait "$serve_pid"
