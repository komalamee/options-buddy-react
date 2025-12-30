# Options Buddy

A personal options trading dashboard with Interactive Brokers (IBKR) integration. Built for premium-selling traders who want to track positions, analyze opportunities, and manage their options portfolio.

## Features

- **Dashboard** - Portfolio overview with key metrics and alerts
- **Positions** - Track open and closed option positions
- **Scanner** - Find options opportunities based on delta, DTE, and IV
- **Holdings** - View stock holdings with covered call lot availability
- **Performance** - Trading analytics, win rate, and P&L tracking
- **AI Advisor** - AI-powered trading assistant with portfolio context
- **IBKR Integration** - Connect to TWS or IB Gateway for live data sync

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Python FastAPI, ib_insync
- **Database**: SQLite (local, no external database needed)

---

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.10+
- Interactive Brokers account with TWS or IB Gateway

### Installation

1. **Clone the repository:**
```bash
git clone https://github.com/yourusername/options-buddy-react.git
cd options-buddy-react
```

2. **Install frontend dependencies:**
```bash
npm install
```

3. **Install backend dependencies:**
```bash
cd backend
pip install -r requirements.txt
cd ..
```

4. **Configure environment files:**
```bash
# Frontend (optional - defaults work for local development)
cp .env.local.example .env.local

# Backend
cp backend/.env.example backend/.env
```

### Running the App

**Terminal 1 - Backend:**
```bash
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload --loop asyncio
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

Open http://localhost:3000 in your browser.

---

## Interactive Brokers Setup

Options Buddy connects to Interactive Brokers via the TWS API. You'll need either **TWS (Trader Workstation)** or **IB Gateway** running.

### Option A: IB Gateway (Recommended)

IB Gateway is lightweight and designed for API connections.

1. **Download IB Gateway:**
   - Go to: https://www.interactivebrokers.com/en/trading/ibgateway-stable.php
   - Download and install for your platform

2. **Launch IB Gateway:**
   - Select "IB API" (not "FIX CTCI")
   - Log in with your IBKR credentials
   - Choose "Paper Trading" for testing or "Live Trading" for real data

3. **Configure API Settings:**
   - Navigate to: Configure > Settings > API > Settings
   - Enable these options:
     - ✅ Enable ActiveX and Socket Clients
     - ✅ Read-Only API (recommended for safety)
   - Set "Socket port" (default: 4001 for live, 4002 for paper)
   - Add `127.0.0.1` to "Trusted IPs" if prompted

### Option B: TWS (Trader Workstation)

If you prefer the full trading interface:

1. **Download TWS:**
   - Go to: https://www.interactivebrokers.com/en/trading/tws.php
   - Download "TWS Latest" or "TWS Stable"

2. **Configure API Settings:**
   - Go to: File > Global Configuration > API > Settings
   - Enable:
     - ✅ Enable ActiveX and Socket Clients
     - ✅ Read-Only API
   - Note the port (default: 7497 for live, 7496 for paper)

### Port Reference

| Software | Mode | Default Port |
|----------|------|--------------|
| IB Gateway | Live | 4001 |
| IB Gateway | Paper | 4002 |
| TWS | Live | 7497 |
| TWS | Paper | 7496 |

### Connecting from Options Buddy

1. Ensure IB Gateway or TWS is running and logged in
2. Open Options Buddy and go to **Settings**
3. In the "IBKR Connection" tab:
   - Host: `127.0.0.1` (default)
   - Port: Enter your port (e.g., `4001` for IB Gateway Live)
4. Click **Connect to IBKR**
5. Once connected, click **Sync Positions** to import your portfolio

### Troubleshooting IBKR Connection

| Issue | Solution |
|-------|----------|
| "Connection refused" | Ensure IB Gateway/TWS is running and API is enabled |
| "Port already in use" | Another app is using the port; change the port or close conflicting apps |
| "Not logged in" | Log into IB Gateway/TWS first before connecting |
| "No market data" | Check your market data subscriptions in IBKR Account Management |
| "Timeout" | Increase timeout in settings; IBKR can be slow to respond |

---

## AI Advisor Setup

The AI Advisor feature provides intelligent trading insights based on your portfolio. It supports multiple AI providers.

### Supported Providers

| Provider | Model | Best For | Pricing |
|----------|-------|----------|---------|
| **Anthropic** | Claude 3.5 Sonnet | Best reasoning, nuanced analysis | ~$3/1M tokens |
| **OpenAI** | GPT-4o | Fast, good general purpose | ~$2.50/1M tokens |
| **Google** | Gemini 1.5 Flash | Cheapest, good for basic queries | ~$0.075/1M tokens |

### Recommendation

**For options trading analysis, we recommend Anthropic Claude** - it provides the most thoughtful analysis of complex trading scenarios and risk assessment.

### Getting API Keys

#### Anthropic (Claude)
1. Go to: https://console.anthropic.com/
2. Create an account or sign in
3. Navigate to: Settings > API Keys
4. Click "Create Key"
5. Copy the key (starts with `sk-ant-`)

#### OpenAI (GPT-4)
1. Go to: https://platform.openai.com/
2. Create an account or sign in
3. Navigate to: API Keys (left sidebar)
4. Click "Create new secret key"
5. Copy the key (starts with `sk-`)

#### Google (Gemini)
1. Go to: https://aistudio.google.com/apikey
2. Sign in with your Google account
3. Click "Create API key"
4. Select or create a Google Cloud project
5. Copy the key

### Configuring in Options Buddy

1. Go to **Settings** > **AI Tab**
2. Select your provider from the dropdown
3. Paste your API key
4. Click **Save AI Settings**
5. Click **Test Connection** to verify

### Cost Estimates

Typical usage (10-20 queries/day):
- **Anthropic**: ~$1-3/month
- **OpenAI**: ~$1-2/month
- **Google**: ~$0.10-0.50/month

---

## Environment Variables

### Backend (`backend/.env`)

```bash
# Interactive Brokers Connection
IBKR_HOST=127.0.0.1
IBKR_PORT=4001
# 4001 = IB Gateway Live
# 4002 = IB Gateway Paper
# 7497 = TWS Live
# 7496 = TWS Paper

# Market Data Type
# 1 = Live (requires market data subscription)
# 2 = Frozen (last available price when market closed)
# 3 = Delayed (15-20 min delay, free)
# 4 = Delayed Frozen
IBKR_MARKET_DATA_TYPE=2

# Database Path (optional)
# DB_PATH=/path/to/your/options_buddy.db

# AI API Keys (add your keys here)
GEMINI_API_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# API Server Settings
API_HOST=0.0.0.0
API_PORT=8000
```

### Frontend (`.env.local`)

```bash
# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Data Storage

All data is stored locally in a SQLite database (`backend/data_store/options_buddy.db`). This includes:

- Your synced positions and holdings
- Closed trade history
- Performance statistics
- App settings and AI API keys (encrypted)

**Your data never leaves your machine** - there's no cloud sync or external database.

To reset your data, simply delete the database file:
```bash
rm backend/data_store/options_buddy.db
```

---

## API Reference

### IBKR Connection
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ibkr/status` | GET | Get connection status |
| `/api/ibkr/connect` | POST | Connect to IBKR |
| `/api/ibkr/disconnect` | POST | Disconnect from IBKR |
| `/api/ibkr/sync` | POST | Sync positions from IBKR |

### Portfolio
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/portfolio/summary` | GET | Get portfolio summary |
| `/api/positions` | GET | Get positions (query: `status=open/closed`) |
| `/api/holdings` | GET | Get stock holdings |
| `/api/performance` | GET | Get performance stats |

### Scanner
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/scanner/scan` | POST | Run options scan |

### AI Chat
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chat` | POST | Send message to AI advisor |

---

## Development

### Project Structure

```
options-buddy-react/
├── backend/
│   ├── main.py           # FastAPI app and routes
│   ├── database.py       # SQLite operations
│   ├── ibkr_service.py   # IBKR integration
│   ├── config.py         # Configuration
│   └── data_store/       # Database storage
│
├── src/
│   ├── app/              # Next.js pages
│   ├── components/       # React components
│   ├── lib/              # API client, utilities
│   ├── stores/           # Zustand state management
│   └── types/            # TypeScript definitions
```

### Running Tests

```bash
# Frontend
npm run test

# Backend
cd backend
pytest
```

---

## Security Notes

- API keys are stored in your local SQLite database
- IBKR connection is read-only by default (no trading capability)
- All data stays on your machine
- No telemetry or external data collection

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

MIT

---

## Support

If you encounter issues:
1. Check the [Troubleshooting](#troubleshooting-ibkr-connection) section
2. Ensure IB Gateway/TWS is running and properly configured
3. Open an issue on GitHub with details about your setup
