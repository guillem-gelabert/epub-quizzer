# EPUB Quizzer

An interactive EPUB reader with AI-generated quizzes to test comprehension.

## Features

- Upload and read EPUB books
- AI-generated comprehension quizzes based on reading content
- Session-based progress tracking
- PostgreSQL backend with GraphQL API

## Setup

### Prerequisites

- Node.js 18+ (for local development)
- Docker and Docker Compose (for containerized setup)
- PostgreSQL database (or use Docker Compose)

### Local Development

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` and set:
- `DATABASE_URL` - PostgreSQL connection string
- `OPENAI_API_KEY` - Your OpenAI API key

3. Set up the database:
```bash
npx prisma migrate dev
npx prisma generate
```

4. Start the development server:
```bash
npm run dev
```

### Docker Setup

#### Development with Docker Compose

**Prerequisites:**
- Docker Desktop must be running and unpaused
- If you see "Docker Desktop is manually paused", unpause it through the Docker Desktop menu

1. Create `.env` file:
```bash
cp .env.example .env
```

Edit `.env` and set:
- `POSTGRES_USER` - PostgreSQL username (default: epubquizzer)
- `POSTGRES_PASSWORD` - PostgreSQL password (default: epubquizzer)
- `POSTGRES_DB` - Database name (default: epub_quizzer)
- `OPENAI_API_KEY` - Your OpenAI API key

2. Start services:
```bash
docker compose -f docker-compose.dev.yml up -d
```

Or use the npm script:
```bash
npm run docker:dev
```

3. Run database migrations:
```bash
docker compose -f docker-compose.dev.yml exec app npx prisma migrate dev
```

Or use the npm script:
```bash
npm run docker:migrate:dev
```

4. Access the application:
- App: http://localhost:3000
- Database: localhost:5432

#### Production with Docker Compose

**Prerequisites:**
- Docker Desktop must be running and unpaused

1. Create `.env` file with production values

2. Build and start:
```bash
docker compose up -d --build
```

Or use the npm script:
```bash
npm run docker:prod
```

3. Run database migrations:
```bash
docker compose exec app npx prisma migrate deploy
```

Or use npm script:
```bash
npm run docker:migrate
```

4. Access the application at http://localhost:3000

#### Using npm scripts

- Development: `npm run docker:dev`
- Production: `npm run docker:prod`
- Stop dev: `npm run docker:dev:down`
- Stop prod: `npm run docker:prod:down`
- Run migrations (prod): `npm run docker:migrate`
- Run migrations (dev): `npm run docker:migrate:dev`

#### Docker Commands

- View logs: `docker-compose logs -f app`
- Stop services: `docker-compose down`
- Stop and remove volumes: `docker-compose down -v`
- Rebuild: `docker-compose build --no-cache`

## Architecture

- **Frontend**: Nuxt 3 with Vue 3
- **Backend**: Nuxt server routes + Apollo GraphQL
- **Database**: PostgreSQL with Prisma ORM
- **AI**: OpenAI API for quiz generation

## GraphQL API

The GraphQL endpoint is available at `/api/graphql`.

### Key Queries

- `books` - Get all books for current session
- `book(id)` - Get book details with sections
- `bookToc(bookId)` - Get table of contents
- `chunks(bookId, from, limit)` - Get reading chunks
- `progress(bookId)` - Get reading progress
- `quizzes(bookId)` - Get quizzes for a book

### Key Mutations

- `createSession` - Create or get current session
- `addBookToSession(bookId)` - Add book to session library
- `updateProgress(input)` - Update reading progress
- `createQuiz(input)` - Generate or retrieve quiz for a gate
- `submitQuizAttempt(input)` - Submit quiz answers

## Database Schema

- `Session` - Anonymous user sessions (cookie-based)
- `Book` - Canonical book records (deduplicated by content hash)
- `BookSection` - Parsed HTML per spine item
- `Chunk` - Precomputed 60-120 word reading units
- `SessionBook` - Books linked to sessions
- `ReadingProgress` - Progress tracking per session+book
- `Quiz` - Generated quizzes per gate window
- `QuizAttempt` - Quiz answer submissions

## Development

Run Prisma Studio to view database:
```bash
npx prisma studio
```

Generate Prisma client after schema changes:
```bash
npx prisma generate
```

Create a new migration:
```bash
npx prisma migrate dev --name migration_name
```
