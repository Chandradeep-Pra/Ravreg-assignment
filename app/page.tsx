import { VoiceAgent } from "@/components/voice-agent"

export default function Home() {
  return (
    <main className="flex flex-col h-dvh bg-background text-foreground">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center size-8 rounded-lg bg-primary">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="size-4 text-primary-foreground"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" x2="12" y1="19" y2="22" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-foreground">
              Voice Agent
            </h1>
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
              LiveKit + Gemini AI
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider hidden sm:block">
            Real-time Voice Interface
          </span>
        </div>
      </div>

      {/* Voice Agent */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <VoiceAgent />
      </div>
    </main>
  )
}
