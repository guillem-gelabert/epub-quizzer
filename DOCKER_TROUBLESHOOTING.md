# Docker Troubleshooting Guide

## Common Issues

### Docker Desktop Not Running
**Error:** `Docker Desktop is manually paused`

**Solution:**
1. Open Docker Desktop application
2. Click "Resume" or "Unpause" button
3. Wait for Docker to fully start (whale icon should be active)

### Database Connection Issues

**Error:** `Can't reach database server` or Drizzle connection errors

**Solutions:**
1. Ensure PostgreSQL container is running:
   ```bash
   docker compose ps
   ```

2. Check database logs:
   ```bash
   docker compose logs postgres
   ```

3. Verify DATABASE_URL in container:
   ```bash
   docker compose exec app printenv DATABASE_URL
   ```

4. Run migrations:
   ```bash
   docker compose exec app npx drizzle-kit migrate
   ```

### Build Failures

**Error:** Build fails during `npm run build`

**Solutions:**
1. Check build logs:
   ```bash
   docker compose build --no-cache app
   ```

2. Verify all dependencies are installed:
   ```bash
   docker compose run --rm app npm ci
   ```

3. Check for TypeScript errors:
   ```bash
   docker compose run --rm app npx tsc --noEmit
   ```

### Port Already in Use

**Error:** `port is already allocated` or `address already in use`

**Solution:**
1. Change port in `.env`:
   ```
   APP_PORT=3001
   POSTGRES_PORT=5433
   ```

2. Or stop conflicting services:
   ```bash
   # Find process using port 3000
   lsof -i :3000
   # Kill the process
   kill -9 <PID>
   ```

### Drizzle Schema Issues

**Error:** `Cannot find module` or schema-related errors

**Solution:**
```bash
# Generate migrations from schema changes
docker compose exec app npx drizzle-kit generate

# Apply migrations
docker compose exec app npx drizzle-kit migrate
```

### Session Middleware Errors

**Error:** Database connection errors in session middleware

**Note:** The middleware has fallback behavior - if the database is unavailable, it will use temporary session IDs. This allows the app to start even if migrations haven't been run yet.

**Solution:** Run migrations as soon as the database is ready:
```bash
docker compose exec app npx drizzle-kit migrate
```

## Useful Commands

### View Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f app
docker compose logs -f postgres
```

### Restart Services
```bash
# Restart all
docker compose restart

# Restart specific service
docker compose restart app
```

### Access Container Shell
```bash
# App container
docker compose exec app sh

# Database container
docker compose exec postgres psql -U epubquizzer -d epub_quizzer
```

### Clean Up
```bash
# Stop and remove containers
docker compose down

# Stop and remove containers + volumes (WARNING: deletes data)
docker compose down -v

# Remove all images
docker compose down --rmi all
```

## Environment Variables

Make sure your `.env` file has:
- `OPENAI_API_KEY` - Required for quiz generation
- `POSTGRES_USER` - Optional (defaults to epubquizzer)
- `POSTGRES_PASSWORD` - Optional (defaults to epubquizzer)
- `POSTGRES_DB` - Optional (defaults to epub_quizzer)

The `DATABASE_URL` is automatically constructed by docker-compose from the POSTGRES_* variables.

