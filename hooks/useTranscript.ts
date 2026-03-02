import { useState } from "react"

export interface TranscriptEntry {
  id: string
  speaker: "user" | "agent"
  text: string
  timestamp: number
}

export function useTranscript() {
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])

  const addEntry = (speaker: "user" | "agent", text: string) => {
    setTranscript((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        speaker,
        text,
        timestamp: Date.now(),
      },
    ])
  }

  const clear = () => setTranscript([])

  return { transcript, addEntry, clear }
}