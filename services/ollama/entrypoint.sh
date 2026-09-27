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

# Loads the weights into RAM before the first player action. Ollama loads a
# model lazily, on the first request, and that load costs more than the app
# grants a generation in LLM_TIMEOUT_MS — so without this the first reply of a
# session is always abandoned and served from a template. Backgrounded so a
# shutdown signal arriving mid-warm-up is not stuck behind it, and tolerated on
# failure for the same reason a failed pull is: a model that will not warm up
# leaves a degraded game, not a dead container.
if ollama show "$LLM_MODEL" >/dev/null 2>&1; then
  (
    if ollama run "$LLM_MODEL" "ok" >/dev/null 2>&1; then
      echo "entrypoint: warmed up $LLM_MODEL"
    else
      echo "entrypoint: WARNING warm-up of $LLM_MODEL failed" >&2
    fi
  ) &
fi

wait "$serve_pid"
