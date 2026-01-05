#!/bin/sh
# Run Drizzle migrations in Docker container

echo "Running Drizzle migrations..."

# Check if we're in docker-compose context
if [ -f docker-compose.yml ]; then
  docker-compose exec app npx drizzle-kit migrate
elif [ -f docker-compose.dev.yml ]; then
  docker-compose -f docker-compose.dev.yml exec app npx drizzle-kit migrate
else
  echo "Error: docker-compose.yml not found"
  exit 1
fi

echo "Migrations completed!"
