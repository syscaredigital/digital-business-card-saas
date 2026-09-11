#!/bin/sh
set -eu
# Run from the project root on the VPS. Keep copies off the VPS as well.
mkdir -p backups
stamp=$(date -u +%Y%m%dT%H%M%SZ)
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "backups/database-$stamp.dump"
docker compose exec -T app tar czf - -C /app/backend/uploads . > "backups/uploads-$stamp.tar.gz"
echo "Backups created for $stamp. Verify and copy them to separate storage."
