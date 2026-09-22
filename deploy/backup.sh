#!/bin/sh
set -eu
umask 077
# Run from project root; stop external workers/cron writers before running.
mkdir -p backups
exec 9>backups/.backup.lock
flock -n 9 || { echo 'Another backup is running' >&2; exit 1; }
stamp=$(date -u +%Y%m%dT%H%M%SZ)
bundle="backups/$stamp.incomplete"
mkdir "$bundle"
running=$(docker compose ps --status running -q app)
[ -n "$running" ] || { echo 'Start the app before taking a managed maintenance backup' >&2; exit 1; }
restart() { docker compose start app >/dev/null; }
trap restart EXIT
trap 'exit 1' INT TERM
docker compose stop -t 60 app
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$bundle/database.dump"
docker compose run --rm --no-deps -T --entrypoint tar app czf - -C /app/backend/uploads . > "$bundle/uploads.tar.gz"
docker compose exec -T db pg_restore --list < "$bundle/database.dump" > "$bundle/database.contents"
tar tzf "$bundle/uploads.tar.gz" > "$bundle/uploads.contents"
(cd "$bundle" && sha256sum database.dump uploads.tar.gz > SHA256SUMS)
printf 'UTC=%s\nCONSISTENCY=app stopped; external writers must be stopped by operator\n' "$stamp" > "$bundle/manifest.txt"
mv "$bundle" "backups/$stamp"
echo "Consistent backup: backups/$stamp. Encrypt and copy offsite; run an isolated restore before relying on it."
