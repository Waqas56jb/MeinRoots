#!/usr/bin/env bash
#
# MeinRoots backup.
#
# Two things here cannot be reconstructed if the disk dies: the database, and
# the uploaded CV files. Everything else is in git or can be reinstalled.
#
#   /opt/meinroots/backups/db/meinroots-YYYYmmdd-HHMMSS.sql.gz
#   /opt/meinroots/backups/storage/storage-YYYYmmdd-HHMMSS.tar.gz
#
# Installed by deploy/install-backups.sh to run daily at 03:20.
#
# Restore is documented at the bottom of this file — an untested restore is not
# a backup, so the steps are written where whoever needs them will look.

set -euo pipefail

BACKUP_ROOT="${BACKUP_ROOT:-/opt/meinroots/backups}"
STORAGE_DIR="${STORAGE_DIR:-/opt/meinroots/server/storage}"
ENV_FILE="${ENV_FILE:-/opt/meinroots/server/.env}"
KEEP_DAYS="${KEEP_DAYS:-14}"
# Keep one backup per month beyond the daily window, so a corruption noticed
# late is still recoverable from before it happened.
KEEP_MONTHLY="${KEEP_MONTHLY:-6}"

STAMP="$(date +%Y%m%d-%H%M%S)"
DB_DIR="$BACKUP_ROOT/db"
ST_DIR="$BACKUP_ROOT/storage"
LOG_TAG="meinroots-backup"

log() { logger -t "$LOG_TAG" "$*" 2>/dev/null || true; echo "[$(date '+%F %T')] $*"; }
fail() { log "FAILED: $*"; exit 1; }

mkdir -p "$DB_DIR" "$ST_DIR"

# The connection string lives only in the API's .env; parsing it here means the
# credentials are in exactly one place on the box.
[ -f "$ENV_FILE" ] || fail "no env file at $ENV_FILE"
DATABASE_URL="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2-)"
[ -n "$DATABASE_URL" ] || fail "DATABASE_URL missing from $ENV_FILE"

# ------------------------------- database ------------------------------------
DB_FILE="$DB_DIR/meinroots-$STAMP.sql.gz"
log "dumping database"
# --no-owner so the dump restores into a database owned by a different role,
# which is what happens on any machine that is not this one.
if pg_dump --no-owner --clean --if-exists "$DATABASE_URL" | gzip -9 > "$DB_FILE.part"; then
  mv "$DB_FILE.part" "$DB_FILE"
else
  rm -f "$DB_FILE.part"
  fail "pg_dump failed"
fi

# A dump that cannot be read is worse than no dump, because it looks like one.
gzip -t "$DB_FILE" || fail "database dump is not a readable gzip"
DB_SIZE=$(stat -c%s "$DB_FILE")
[ "$DB_SIZE" -gt 1024 ] || fail "database dump is suspiciously small ($DB_SIZE bytes)"
log "database ok — $(numfmt --to=iec "$DB_SIZE")"

# -------------------------------- storage ------------------------------------
if [ -d "$STORAGE_DIR" ]; then
  ST_FILE="$ST_DIR/storage-$STAMP.tar.gz"
  log "archiving uploaded CVs"
  tar -czf "$ST_FILE.part" -C "$(dirname "$STORAGE_DIR")" "$(basename "$STORAGE_DIR")" \
    && mv "$ST_FILE.part" "$ST_FILE" || { rm -f "$ST_FILE.part"; fail "storage archive failed"; }
  gzip -t "$ST_FILE" || fail "storage archive is not a readable gzip"
  log "storage ok — $(numfmt --to=iec "$(stat -c%s "$ST_FILE")")"
else
  log "no storage directory at $STORAGE_DIR — skipping"
fi

# ------------------------------- retention -----------------------------------
# Daily copies for KEEP_DAYS, then the 1st of each month for KEEP_MONTHLY.
prune() {
  local dir="$1" pattern="$2"
  find "$dir" -name "$pattern" -type f -mtime "+$KEEP_DAYS" -print0 |
    while IFS= read -r -d '' f; do
      day="$(basename "$f" | grep -oE '[0-9]{8}' | head -1 | cut -c7-8)"
      if [ "$day" = "01" ]; then
        # Monthly keeper — remove only once it is older than the monthly window.
        if [ -n "$(find "$f" -mtime "+$((KEEP_MONTHLY * 31))")" ]; then
          rm -f "$f" && log "pruned monthly $(basename "$f")"
        fi
      else
        rm -f "$f" && log "pruned $(basename "$f")"
      fi
    done
}
prune "$DB_DIR" 'meinroots-*.sql.gz'
prune "$ST_DIR" 'storage-*.tar.gz'

log "complete — $(find "$DB_DIR" -name '*.sql.gz' | wc -l) db, $(find "$ST_DIR" -name '*.tar.gz' 2>/dev/null | wc -l) storage, using $(du -sh "$BACKUP_ROOT" | cut -f1)"

# =============================================================================
# RESTORE
#
# Database (destructive — it drops and recreates every object):
#
#   systemctl stop meinroots-api
#   gunzip -c /opt/meinroots/backups/db/meinroots-YYYYmmdd-HHMMSS.sql.gz \
#     | psql "$(grep -E '^DATABASE_URL=' /opt/meinroots/server/.env | cut -d= -f2-)"
#   systemctl start meinroots-api
#
# Uploaded CVs:
#
#   systemctl stop meinroots-api
#   tar -xzf /opt/meinroots/backups/storage/storage-YYYYmmdd-HHMMSS.tar.gz \
#     -C /opt/meinroots/server
#   chown -R meinroots:meinroots /opt/meinroots/server/storage
#   systemctl start meinroots-api
#
# Restore both from the SAME timestamp. A newer database referencing files that
# an older archive does not contain gives you profiles whose CV downloads 404.
#
# OFF-SERVER COPY — still to do. These backups sit on the same disk as the data
# they protect, which covers a bad deploy or a dropped table but not a dead
# machine. Copying them somewhere else nightly is the remaining step:
#
#   rclone sync /opt/meinroots/backups remote:meinroots-backups
# =============================================================================
