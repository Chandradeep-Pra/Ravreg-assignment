# Real-Time Voice Agent

A real-time voice AI agent built with **Next.js**, **LiveKit**, and **Google Gemini**.  
Users speak into their microphone, the agent transcribes speech, generates a conversational response, and speaks it back with interruption support.

---

## Setup Instructions

### 1. Prerequisites

- Node.js 18+
- pnpm (or npm)
- Chrome or Edge browser (required for SpeechRecognition)
- LiveKit Cloud account (free tier)
- Google Gemini API key (free tier)

---

### 2. Clone and Install

```bash
git clone <your-repo-url>
cd <project-folder>
pnpm install
```

---

### 3. Configure Environment Variables

Create a file named `.env.local` in the root directory:

```env
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
NEXT_PUBLIC_LIVEKIT_URL=wss://your-project.livekit.cloud

GEMINI_API_KEY=your_gemini_api_key
```

---

## How to Run

Start the development server:

```bash
pnpm dev
```

Open your browser:

```
http://localhost:3000
```

Allow microphone access and start speaking.

---

## Required Environment Variables

| Variable | Description |
|----------|-------------|
| LIVEKIT_API_KEY | LiveKit server API key |
| LIVEKIT_API_SECRET | LiveKit server API secret |
| NEXT_PUBLIC_LIVEKIT_URL | LiveKit WebSocket URL |
| GEMINI_API_KEY | Google Gemini API key |

---

## SDK Used

- Next.js (App Router)
- livekit-client
- livekit-server-sdk
- @google/genai
- Web Speech API (SpeechRecognition + speechSynthesis)
- Web Audio API (AnalyserNode for voice activity detection)

---

## External Services

- LiveKit Cloud (WebRTC real-time transport)
- Google Gemini API (LLM responses)

---

## Known Limitations

- SpeechRecognition works only in Chrome and Edge
- Gemini free tier has rate limits
- Speech recognition quality depends on browser engine
- Requires microphone permission
- Not optimized for production-scale deployment