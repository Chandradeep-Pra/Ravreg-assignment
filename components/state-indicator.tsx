"use client"

import { AgentState } from "@/lib/state-machine"
import { cn } from "@/lib/utils"

interface StateIndicatorProps {
  state: AgentState
  audioLevel?: number
}

const STATE_CONFIG: Record<
  AgentState,
  { label: string; colorClass: string; bgClass: string; glowClass: string }
> = {
  [AgentState.IDLE]: {
    label: "Idle",
    colorClass: "bg-agent-idle",
    bgClass: "bg-agent-idle/20",
    glowClass: "shadow-[0_0_20px_rgba(128,128,128,0.3)]",
  },
  [AgentState.LISTENING]: {
    label: "Listening",
    colorClass: "bg-agent-listening",
    bgClass: "bg-agent-listening/20",
    glowClass: "shadow-[0_0_30px_rgba(34,197,94,0.4)]",
  },
  [AgentState.PROCESSING]: {
    label: "Processing",
    colorClass: "bg-agent-processing",
    bgClass: "bg-agent-processing/20",
    glowClass: "shadow-[0_0_30px_rgba(234,179,8,0.4)]",
  },
  [AgentState.SPEAKING]: {
    label: "Speaking",
    colorClass: "bg-agent-speaking",
    bgClass: "bg-agent-speaking/20",
    glowClass: "shadow-[0_0_30px_rgba(6,182,212,0.4)]",
  },
}

export function StateIndicator({ state, audioLevel = 0 }: StateIndicatorProps) {
  const config = STATE_CONFIG[state]
  const scale = 1 + audioLevel * 0.5

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Animated orb */}
      <div className="relative flex items-center justify-center">
        {/* Outer glow ring */}
        <div
          className={cn(
            "absolute size-36 rounded-full transition-all duration-500",
            config.bgClass,
            config.glowClass,
            state === AgentState.LISTENING && "animate-pulse",
            state === AgentState.SPEAKING && "animate-pulse"
          )}
          style={{
            transform: `scale(${scale})`,
            transition: "transform 0.1s ease-out",
          }}
        />
        {/* Middle ring */}
        <div
          className={cn(
            "absolute size-28 rounded-full transition-all duration-500",
            config.bgClass,
            "opacity-50"
          )}
          style={{
            transform: `scale(${1 + audioLevel * 0.3})`,
            transition: "transform 0.1s ease-out",
          }}
        />
        {/* Core orb */}
        <div
          className={cn(
            "relative size-20 rounded-full transition-all duration-300",
            config.colorClass,
            state === AgentState.PROCESSING && "animate-spin-slow"
          )}
          style={{
            transform: `scale(${1 + audioLevel * 0.15})`,
            transition: "transform 0.1s ease-out",
          }}
        />
        {/* Processing spinner overlay */}
        {state === AgentState.PROCESSING && (
          <div className="absolute size-24 animate-spin rounded-full border-2 border-transparent border-t-agent-processing" />
        )}
      </div>

      {/* State label */}
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "size-2 rounded-full transition-colors duration-300",
            config.colorClass
          )}
        />
        <span className="text-sm font-mono tracking-wider uppercase text-muted-foreground">
          {config.label}
        </span>
      </div>
    </div>
  )
}
