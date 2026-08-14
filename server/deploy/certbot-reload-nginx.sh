#!/usr/bin/env bash
#
# Certbot deploy hook — reloads nginx after a certificate is renewed.
#
# Install to /etc/letsencrypt/renewal-hooks/deploy/ and chmod +x. Certbot runs
# everything in that directory after a successful renewal.
#
# Without this, renewal succeeds and nothing changes: nginx keeps the old
# certificate in memory until it is reloaded for some unrelated reason. The
# failure is invisible for weeks and then the site is suddenly untrusted, which
# is the worst possible time to discover it.
#
# `reload` rather than `restart`: it re-reads the certificates without dropping
# a single in-flight request.

set -euo pipefail

if nginx -t 2>/dev/null; then
  systemctl reload nginx
  logger -t certbot-deploy "nginx reloaded after certificate renewal (${RENEWED_DOMAINS:-unknown})"
else
  # Never reload a broken config — that would take the site down entirely,
  # which is far worse than serving a certificate that is still valid today.
  logger -t certbot-deploy "nginx config test FAILED, refusing to reload after renewal"
  exit 1
fi
