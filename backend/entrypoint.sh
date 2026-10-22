#!/bin/sh
set -e

echo "Attente de PostgreSQL puis application des migrations…"
i=0
until python manage.py migrate --noinput; do
  i=$((i + 1))
  if [ "$i" -ge 30 ]; then
    echo "Impossible de joindre la base de données" >&2
    exit 1
  fi
  echo "Base indisponible, nouvelle tentative ($i/30)…"
  sleep 2
done

python manage.py collectstatic --noinput

exec "$@"
