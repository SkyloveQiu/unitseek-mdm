#!/bin/bash
set -e

echo "=== Unitseek MDM - Development Setup ==="
echo ""

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}[1/5] Starting PostgreSQL via Docker...${NC}"
docker compose up -d db
echo -e "${GREEN}OK${NC}"

echo -e "${BLUE}[2/5] Waiting for PostgreSQL...${NC}"
sleep 3
until docker compose exec db pg_isready -U unitseek_mdm -d unitseek_mdm > /dev/null 2>&1; do
    echo "  Waiting..."
    sleep 2
done
echo -e "${GREEN}OK${NC}"

echo -e "${BLUE}[3/5] Setting up backend...${NC}"
cd backend
if [ ! -f .env ]; then
    cp .env.example .env
    echo "  Created .env from .env.example"
fi
pip3 install -r requirements.txt -q
echo -e "${GREEN}OK${NC}"

echo -e "${BLUE}[4/5] Running database migrations...${NC}"
alembic upgrade head 2>/dev/null || echo "  (No migrations yet - run 'alembic revision --autogenerate' first)"
echo -e "${GREEN}OK${NC}"

echo -e "${BLUE}[5/5] Setting up frontend...${NC}"
cd ../frontend
npm install --silent
echo -e "${GREEN}OK${NC}"

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Start backend:  cd backend && uvicorn app.main:app --reload --port 8003"
echo "Start frontend: cd frontend && npm run dev"
echo ""
echo "Or use Docker:  docker compose up"
echo ""
echo "Backend API:    http://localhost:8003/docs"
echo "Frontend:       http://localhost:5173"
