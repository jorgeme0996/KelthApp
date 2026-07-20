#!/usr/bin/env bash
# Levanta un Postgres desechable en Docker (puerto y nombre propios, no toca
# la base de datos local de desarrollo), corre las migraciones + el seed de
# recetas ahí, ejecuta src/scripts/e2eComodines.ts contra esa base, y la
# destruye al terminar (pase o falle la prueba).
set -euo pipefail

CONTAINER_NAME="kelthapp-e2e-comodines-db"
HOST_PORT=5555
DATABASE_URL="postgresql://kelthapp:kelthapp@localhost:${HOST_PORT}/kelthapp?schema=public"

cleanup() {
  echo "Eliminando contenedor de base de datos efímero ($CONTAINER_NAME)..."
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Levantando Postgres efímero en el puerto $HOST_PORT..."
docker run -d --rm \
  --name "$CONTAINER_NAME" \
  -e POSTGRES_USER=kelthapp \
  -e POSTGRES_PASSWORD=kelthapp \
  -e POSTGRES_DB=kelthapp \
  -p "${HOST_PORT}:5432" \
  postgres:16-alpine >/dev/null

echo "Esperando a que Postgres acepte conexiones..."
for i in $(seq 1 30); do
  if docker exec "$CONTAINER_NAME" pg_isready -U kelthapp >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

cd "$(dirname "$0")/.."

echo "Aplicando migraciones..."
DATABASE_URL="$DATABASE_URL" npx prisma migrate deploy

echo "Sembrando catálogo de recetas..."
DATABASE_URL="$DATABASE_URL" npm run seed

echo "Corriendo pruebas e2e de comodines..."
DATABASE_URL="$DATABASE_URL" npm run test:comodines-e2e
