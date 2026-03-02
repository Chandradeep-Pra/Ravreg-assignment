"use client";

import { useEffect, useRef } from "react";
import type { TranscriptEntry } from "@/hooks/use-voice-agent";

interface TranscriptPanelProps {
  transcript: TranscriptEntry[];
  interimText: string;
  currentState: string;
}

export function TranscriptPanel({
  transcript,
  interimText,
  currentState,
}: TranscriptPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript, interimText]);

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 h-full min-h-0 overflow-hidden">
      <div className="flex-none flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-foreground uppercase">
          Transcript
        </h2>
        <span className="text-xs text-muted-foreground capitalize">
          {currentState.replace(/-/g, " ")}
        </span>
      </div>

      <div
        ref={scrollRef}
        className="flex flex-col gap-3 flex-1 overflow-y-auto min-h-0 pr-1 scroll-smooth
          [&::-webkit-scrollbar]:w-1.5
          [&::-webkit-scrollbar-track]:bg-transparent
          [&::-webkit-scrollbar-thumb]:rounded-full
          [&::-webkit-scrollbar-thumb]:bg-border
          hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/30"
      >
        {transcript.length === 0 && !interimText && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="opacity-40"
            >
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" x2="12" y1="19" y2="22" />
            </svg>
            <p className="text-xs">Connect and start speaking</p>
          </div>
        )}

        {transcript.map((entry) => (
          <div
            key={entry.id}
            className={`flex flex-col gap-0.5 ${
              entry.speaker === "user" ? "items-end" : "items-start"
            }`}
          >
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {entry.speaker === "user" ? "You" : "Agent"}
            </span>
            <div
              className={`rounded-lg px-3 py-2 max-w-[85%] text-sm leading-relaxed ${
                entry.text === "[interrupted]"
                  ? "bg-destructive/10 text-destructive italic text-xs"
                  : entry.speaker === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
              }`}
            >
              {entry.text === "[interrupted]" ? "Barge-in: speech cancelled" : entry.text}
            </div>
            <span className="text-xs text-muted-foreground tabular-nums" suppressHydrationWarning>
              {new Date(entry.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          </div>
        ))}

        {/* Interim text */}
        {interimText && (
          <div className="flex flex-col gap-0.5 items-end">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              You (listening...)
            </span>
            <div className="rounded-lg px-3 py-2 max-w-[85%] text-sm leading-relaxed bg-primary/10 text-foreground border border-primary/20">
              {interimText}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
