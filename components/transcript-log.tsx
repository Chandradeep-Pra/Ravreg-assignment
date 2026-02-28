"use client"

import { useEffect, useRef } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

export interface TranscriptEntry {
  id: string
  role: "user" | "agent"
  text: string
  timestamp: Date
}

interface TranscriptLogProps {
  entries: TranscriptEntry[]
  interimText?: string
}

export function TranscriptLog({ entries, interimText }: TranscriptLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [entries, interimText])

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-3 p-4">
        {entries.length === 0 && !interimText && (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-muted-foreground font-mono">
              Waiting for conversation...
            </p>
          </div>
        )}

        {entries.map((entry) => (
          <div
            key={entry.id}
            className={cn(
              "flex flex-col gap-1 max-w-[80%]",
              entry.role === "user" ? "self-end items-end" : "self-start items-start"
            )}
          >
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              {entry.role === "user" ? "You" : "Agent"}
            </span>
            <div
              className={cn(
                "rounded-lg px-3 py-2 text-sm leading-relaxed",
                entry.role === "user"
                  ? "bg-primary/15 text-foreground"
                  : "bg-secondary text-secondary-foreground"
              )}
            >
              {entry.text}
            </div>
            <span className="text-[10px] font-mono text-muted-foreground/60">
              {entry.timestamp.toLocaleTimeString()}
            </span>
          </div>
        ))}

        {/* Interim (live) transcription */}
        {interimText && (
          <div className="flex flex-col gap-1 max-w-[80%] self-end items-end opacity-60">
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              You (listening...)
            </span>
            <div className="rounded-lg px-3 py-2 text-sm leading-relaxed bg-primary/10 text-foreground italic">
              {interimText}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  )
}
