# Options Buddy

A personal options trading dashboard with Interactive Brokers (IBKR) integration. Track your positions, analyze opportunities, and manage your options portfolio.

## Features

- **Dashboard** - Portfolio overview with key metrics
- **Positions** - Track open and closed option positions
- **Scanner** - Find options opportunities based on your criteria
- **Holdings** - View stock holdings with covered call lot availability
- **Performance** - Trading analytics and P&L tracking
- **AI Advisor** - AI-powered trading assistant (requires API key)
- **IBKR Integration** - Connect to TWS or IB Gateway for live data sync

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS, Shadcn/ui
- **Backend**: Python FastAPI, ib_insync
- **Database**: SQLite

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.10+
- Interactive Brokers TWS or IB Gateway (for live trading data)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/options-buddy-react.git
cd options-buddy-react
```

2. Install frontend dependencies:
```bash
npm install
```

3. Install backend dependencies:
```bash
cd backend
pip install -r requirements.txt
```

4. Configure environment:
```bash
# Frontend (optional - defaults work for local development)
cp .env.local.example .env.local

# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with your settings
```

### Running the App

1. Start the backend API:
```bash
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload --loop asyncio
```

2. Start the frontend (in a new terminal):
```bash
npm run dev
```

3. Open http://localhost:3000 in your browser

### Connecting to IBKR

1. Start TWS or IB Gateway
2. Enable API connections in TWS: File > Global Configuration > API > Settings
3. Check "Enable ActiveX and Socket Clients"
4. Go to Settings page in Options Buddy and click "Connect to IBKR"

## Configuration

### Backend Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| IBKR_HOST | 127.0.0.1 | IBKR API host |
| IBKR_PORT | 4001 | IBKR API port (4001=Gateway, 7497=TWS) |
| IBKR_MARKET_DATA_TYPE | 2 | 1=Live, 2=Frozen, 3=Delayed |
| DB_PATH | ./data_store/options_buddy.db | Database file path |
| GEMINI_API_KEY | | Google Gemini API key (optional) |
| OPENAI_API_KEY | | OpenAI API key (optional) |
| ANTHROPIC_API_KEY | | Anthropic API key (optional) |

### Frontend Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| NEXT_PUBLIC_API_URL | http://localhost:8000 | Backend API URL |

## API Endpoints

### IBKR Connection
- `GET /api/ibkr/status` - Get connection status
- `POST /api/ibkr/connect` - Connect to IBKR
- `POST /api/ibkr/disconnect` - Disconnect from IBKR
- `POST /api/ibkr/sync` - Sync positions from IBKR

### Portfolio
- `GET /api/portfolio/summary` - Get portfolio summary
- `GET /api/positions` - Get positions
- `GET /api/holdings` - Get stock holdings
- `GET /api/performance` - Get performance stats

### Scanner
- `POST /api/scanner/scan` - Run options scan

## License

MIT
