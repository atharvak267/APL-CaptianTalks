# 🏏 Captain Talks — Virtual IPL Captain AI

An agentic AI system that acts as a virtual IPL captain, making real-time tactical decisions with ball-by-ball simulation powered by Google Gemini.

## Features

- **🧠 Tactical AI Decisions** — Bowling changes, field placements, batting order, strategic timeouts, Impact Player usage
- **⚾ Ball-by-Ball Simulation** — Simulates each delivery with commentary, outcomes, and captain's tactical thinking
- **📊 Strategy Log** — Track every decision and ball in a running tactical log
- **💬 Match Chat** — Conversational AI for discussing strategy, matchups, and tactics
- **🏏 Live Match Data** — Auto-fetch real live scores via CricketData.org API (optional)
- **⚡ Quick Presets** — Pre-loaded match scenarios (death over chase, powerplay collapse, etc.)
- **🗄️ Supabase Integration** — Save match sessions and chat history (optional)

## Setup

### 1. Gemini API Key (Required)
- Go to [Google AI Studio](https://aistudio.google.com/apikey)
- Create a free API key
- Launch the app → the **Settings modal** will open automatically
- Paste your API key and click **💾 Save Settings**

> ⚠️ **No API key is hardcoded** — you must provide your own.

### 2. CricketData.org API Key (Optional — for live scores)
- Sign up free at [cricketdata.org](https://cricketdata.org) (100 requests/day)
- Get your API key from the dashboard
- Add it in the app's Settings → **🏏 CricketData.org API**

### 3. Supabase (Optional — for data persistence)
- Create a project at [supabase.com](https://supabase.com)
- Go to SQL Editor and run the contents of `setup.sql`
- Copy your **Project URL** and **Anon Key** from Project Settings → API
- Add them in the app's Settings modal

### 4. Run
Simply open `index.html` in a browser (use a local server for best results):

```bash
# Using Python
python -m http.server 8000

# Using Node
npx serve .
```

Then visit `http://localhost:8000`

## How It Works

1. **Select teams** → Match data auto-fetches (live API or AI-generated)
2. **Captain's Decision** fires automatically
3. **Ball-by-ball simulation** runs for the next over
4. **Strategy Log** records everything
5. Click **▶ Simulate Next Over** to keep going

## Tech Stack

- **Frontend:** HTML, CSS, JavaScript (Vanilla)
- **AI:** Google Gemini API (`@google/genai`)
- **Live Data:** CricketData.org API
- **Database:** Supabase (PostgreSQL, optional)

## Security

- All API keys are stored in your browser's `localStorage` only
- No keys are hardcoded or committed to the repository
- Keys never leave your browser (all API calls are client-side)
