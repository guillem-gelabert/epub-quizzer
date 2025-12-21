#!/bin/sh
# Run Prisma migrations in Docker container

echo "Running Prisma migrations..."

# Check if we're in docker-compose context
if [ -f docker-compose.yml ]; then
  docker-compose exec app npx prisma migrate deploy
elif [ -f docker-compose.dev.yml ]; then
  docker-compose -f docker-compose.dev.yml exec app npx prisma migrate deploy
else
  echo "Error: docker-compose.yml not found"
  exit 1
fi

echo "Migrations completed!"

