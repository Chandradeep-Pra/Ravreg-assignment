"use client";

import { useMemo } from "react";

interface AudioVisualizerProps {
  levels: number[];
  connectionState: string;
  userIdentity: string;
  agentIdentity: string;
}

export function AudioVisualizer({
  levels,
  connectionState,
  userIdentity,
  agentIdentity,
}: AudioVisualizerProps) {
  const isConnected = connectionState === "connected";

  // Reduce to 32 bars for cleaner display
  const bars = useMemo(() => {
    const barCount = 32;
    const result: number[] = [];
    const step = Math.floor(levels.length / barCount) || 1;
    for (let i = 0; i < barCount; i++) {
      const idx = Math.min(i * step, levels.length - 1);
      result.push(levels[idx] ?? 0);
    }
    return result;
  }, [levels]);

  return (
    <div className="flex flex-col gap-6 rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-foreground uppercase">
          Audio Visualizer
        </h2>
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              isConnected ? "bg-emerald-500" : "bg-muted-foreground"
            }`}
          />
          <span className="text-xs text-muted-foreground">
            {isConnected ? "Live" : "Offline"}
          </span>
        </div>
      </div>

      {/* Visualizer bars */}
      <div className="flex items-end justify-center gap-0.5 h-40 rounded-lg bg-secondary/50 p-4">
        {bars.map((level, i) => {
          const height = isConnected ? Math.max(4, level * 128) : 4;
          const hue = 220 - level * 60; // blue-ish to teal
          return (
            <div
              key={i}
              className="flex-1 rounded-full transition-all duration-75"
              style={{
                height: `${height}px`,
                backgroundColor: isConnected
                  ? `oklch(0.65 0.15 ${hue})`
                  : "var(--muted)",
                opacity: isConnected ? 0.4 + level * 0.6 : 0.3,
              }}
            />
          );
        })}
      </div>

      {/* Participant identities */}
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Room Participants
        </h3>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 rounded-md bg-secondary/50 px-3 py-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-chart-2" />
            <span className="text-xs font-mono text-foreground" suppressHydrationWarning>{userIdentity}</span>
            <span className="ml-auto text-xs text-muted-foreground">Mic Publisher</span>
          </div>
          <div className="flex items-center gap-2 rounded-md bg-secondary/50 px-3 py-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-chart-1" />
            <span className="text-xs font-mono text-foreground" suppressHydrationWarning>{agentIdentity}</span>
            <span className="ml-auto text-xs text-muted-foreground">Subscriber</span>
          </div>
        </div>
      </div>
    </div>
  );
}
