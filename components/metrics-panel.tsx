"use client";

import type { Metrics } from "@/hooks/use-voice-agent";

interface MetricsPanelProps {
  metrics: Metrics;
  connectionState: string;
}

function MetricRow({
  label,
  value,
  unit = "",
}: {
  label: string;
  value: string | number;
  unit?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-mono font-medium text-foreground tabular-nums">
        {typeof value === "number" ? value.toFixed(1) : value}
        {unit && (
          <span className="text-muted-foreground ml-0.5">{unit}</span>
        )}
      </span>
    </div>
  );
}

function StateIndicator({ state }: { state: string }) {
  const colors: Record<string, string> = {
    idle: "bg-muted-foreground",
    connecting: "bg-chart-4",
    "publishing-mic": "bg-chart-4",
    listening: "bg-emerald-500",
    "user-speaking": "bg-chart-2",
    processing: "bg-chart-4",
    "agent-speaking": "bg-chart-1",
    "silence-prompt": "bg-destructive",
    error: "bg-destructive",
  };

  return (
    <div className="flex items-center gap-2 rounded-lg bg-secondary/50 px-3 py-2.5">
      <span
        className={`inline-block h-2.5 w-2.5 rounded-full ${
          colors[state] ?? "bg-muted-foreground"
        } ${
          state === "listening" || state === "user-speaking"
            ? "animate-pulse"
            : ""
        }`}
      />
      <span className="text-xs font-medium text-foreground capitalize">
        {state.replace(/-/g, " ")}
      </span>
    </div>
  );
}

export function MetricsPanel({ metrics, connectionState }: MetricsPanelProps) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
      <h2 className="text-sm font-semibold tracking-wide text-foreground uppercase">
        Dev Metrics
      </h2>

      {/* State */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
          Current State
        </span>
        <StateIndicator state={metrics.currentState} />
      </div>

      {/* Connection */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
          Connection
        </span>
        <div className="rounded-lg bg-secondary/50 px-3 py-1">
          <MetricRow
            label="WebRTC State"
            value={connectionState}
          />
          <MetricRow
            label="Connection Time"
            value={metrics.connectionTime}
            unit="ms"
          />
        </div>
      </div>

      {/* Latency metrics */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
          Latency
        </span>
        <div className="rounded-lg bg-secondary/50 px-3 py-1">
          <MetricRow
            label="STT Finalization"
            value={metrics.sttFinalizationTime}
            unit="ms"
          />
          <MetricRow
            label="Time to First Response"
            value={metrics.timeToFirstResponse}
            unit="ms"
          />
          <MetricRow
            label="TTS Duration"
            value={metrics.ttsDuration}
            unit="ms"
          />
          <MetricRow
            label="Total Roundtrip"
            value={metrics.totalRoundtrip}
            unit="ms"
          />
        </div>
      </div>

      {/* Audio */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
          Audio
        </span>
        <div className="rounded-lg bg-secondary/50 px-3 py-1">
          <MetricRow
            label="Audio Level"
            value={(metrics.audioLevel * 100).toFixed(0)}
            unit="%"
          />
          <MetricRow
            label="Silence Countdown"
            value={metrics.silenceCountdown}
            unit="s"
          />
        </div>
      </div>

      {/* Audio level bar */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
          Input Level
        </span>
        <div className="h-2 rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full rounded-full bg-chart-2 transition-all duration-100"
            style={{ width: `${Math.min(100, metrics.audioLevel * 300)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
