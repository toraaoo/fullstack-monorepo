#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

seed_env() {
	local dir="$1"
	if [[ -f "$dir/.env" ]]; then
		echo "skip  $dir/.env (exists)"
	elif [[ -f "$dir/.env.example" ]]; then
		cp "$dir/.env.example" "$dir/.env"
		echo "seed  $dir/.env"
	fi
}

seed_env .
seed_env apps/api
seed_env apps/web

echo "==> bun install"
bun install

if compgen -G "apps/api/drizzle/*.sql" >/dev/null; then
	echo "==> db:migrate"
	(cd apps/api && bun run db:migrate)
else
	echo "==> no migrations in apps/api/drizzle, skipping db:migrate"
fi

echo "==> ready: bun run dev"
