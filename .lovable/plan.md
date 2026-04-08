

# Portable PostgreSQL with Docker for Kwanza ERP

## What We're Building

A Docker-based PostgreSQL setup that packages the database into a portable container, so you can copy the entire server + data to any PC and start the ERP immediately — like Dolly ERP's InterBase approach.

## Files to Create

### 1. `docker-compose.yml` (project root)
- PostgreSQL 16 container with persistent volume
- Port 5432 exposed to host
- Environment variables for DB credentials
- Named volume `kwanza_pgdata` for data persistence
- Auto-restart policy

### 2. `docker/postgres/init.sql`
- Initialization script that runs on first container start
- Creates `kwanza_erp` database if not exists
- Sets up the DB user with proper privileges

### 3. `docker/migrate-to-docker.sh`
- Script to dump existing local PostgreSQL database (`pg_dump`)
- Restore into Docker container (`pg_restore` / `psql`)
- Verify data integrity after migration

### 4. `docker/portable-export.sh`
- Exports the Docker volume data to a tar archive
- Packages everything needed to move to another PC

### 5. `docker/portable-import.sh`
- On new PC: imports the tar archive into a Docker volume
- Starts the container with restored data
- Verifies ERP can connect

### 6. `DOCKER-SETUP.md`
- Step-by-step instructions for initial setup, migration, portability, and troubleshooting

## docker-compose.yml Structure

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16
    container_name: kwanza-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: kwanza_erp
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-kwanza2024}
    ports:
      - "5432:5432"
    volumes:
      - kwanza_pgdata:/var/lib/postgresql/data
      - ./docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql
volumes:
  kwanza_pgdata:
    driver: local
```

## What Changes in Backend

**Nothing.** The backend `.env` already points to `localhost:5432` — Docker exposes on the same port, so the connection string stays identical:

```
DATABASE_URL=postgresql://postgres:kwanza2024@localhost:5432/kwanza_erp
```

## Migration Workflow

1. `docker compose up -d` — start PostgreSQL container
2. `bash docker/migrate-to-docker.sh` — dump local DB → restore into container
3. Stop local PostgreSQL service (no longer needed)
4. `cd backend && npm run migrate` — ensure schema is current
5. `npm start` — ERP connects to Docker PostgreSQL seamlessly

## Portability Workflow (Move to Another PC)

**Export (source PC):**
```bash
bash docker/portable-export.sh
# Creates: kwanza-erp-portable.tar.gz
```

**Import (new PC):**
```bash
# Install Docker, copy the tar.gz
bash docker/portable-import.sh kwanza-erp-portable.tar.gz
# PostgreSQL starts with all data intact
```

## Prerequisites for User
- Docker Desktop installed on the server PC
- Existing PostgreSQL with `kwanza_erp` database (for initial migration only)

