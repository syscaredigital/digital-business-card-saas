#!/bin/sh
set -eu
umask 077
# Restore only into disposable Docker resources. Never mounts production volumes.
bundle=${1:?Usage: deploy/restore-check.sh backups/TIMESTAMP}
(cd "$bundle" && sha256sum -c SHA256SUMS)
name="syncecard-restore-$(date +%s)-$$"
cleanup() { docker rm -fv "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT
trap 'exit 1' INT TERM
docker run -d --name "$name" --network none -e POSTGRES_HOST_AUTH_METHOD=trust postgres:16-bookworm >/dev/null
attempt=0
until docker exec "$name" pg_isready -U postgres >/dev/null 2>&1; do
  attempt=$((attempt+1))
  [ "$attempt" -lt 30 ] || { echo 'Restore database did not start' >&2; exit 1; }
  sleep 1
done
docker exec "$name" createdb -U postgres restore_check
docker exec -i "$name" pg_restore -U postgres -d restore_check --no-owner --no-acl --exit-on-error < "$bundle/database.dump"
docker exec "$name" mkdir -p /restore-uploads
docker cp "$bundle/uploads.tar.gz" "$name:/tmp/uploads.tar.gz"
docker exec "$name" tar xzf /tmp/uploads.tar.gz -C /restore-uploads
docker exec "$name" psql -U postgres -d restore_check -v ON_ERROR_STOP=1 -c 'SELECT COUNT(*) AS users FROM users; SELECT COUNT(*) AS migrations FROM schema_migrations;'
docker exec "$name" psql -U postgres -d restore_check -At -c "SELECT DISTINCT p FROM (SELECT proof_url p FROM payments UNION SELECT transfer_receipt_url FROM withdrawals) refs WHERE p LIKE '/uploads/payment-slips/%'" > "$bundle/restore-receipts.txt"
while IFS= read -r receipt; do
  case "$receipt" in *..*|*[!a-zA-Z0-9/_.-]*) echo 'Invalid stored receipt path' >&2; exit 1;; esac
  docker exec "$name" test -f "/restore-uploads/${receipt#/uploads/}"
done < "$bundle/restore-receipts.txt"
echo 'Isolated database/upload restore passed. Application acceptance and rollback rehearsal still required.'
