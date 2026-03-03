# Speak Back Voice Agent

A real-time voice AI agent built with **Next.js** and **LiveKit**.  
Users speak into their microphone, the agent transcribes speech and agent speaks it back with interruption support.

---

## Setup Instructions

### 1. Prerequisites

- Node.js 18+
- pnpm (or npm)
- Chrome or Edge browser (required for SpeechRecognition)
- LiveKit Cloud account (free tier)

---

### 2. Clone and Install

```bash
git clone https://github.com/Chandradeep-Pra/Ravreg-assignment.git
cd Ravreg-assignment
pnpm install
```

---

### 3. Configure Environment Variables

Create a file named `.env.local` in the root directory:

```env
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
NEXT_PUBLIC_LIVEKIT_URL=wss://your-project.livekit.cloud
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

---

## Known Limitations

- SpeechRecognition works only in Chrome and Edge
- Speech recognition quality depends on browser engine
- Requires microphone permission
- Not optimized for production-scale deployment
