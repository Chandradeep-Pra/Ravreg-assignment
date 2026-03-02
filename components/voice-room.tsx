"use client";

import { useVoiceAgent } from "@/hooks/use-voice-agent";
import { AudioVisualizer } from "@/components/audio-visualizer";
import { TranscriptPanel } from "@/components/transcript-panel";
import { MetricsPanel } from "@/components/metrics-panel";
import { Mic } from "lucide-react";
import { Button } from "./ui/button";

interface VoiceRoomProps {
  livekitUrl: string;
}

export function VoiceRoom({ livekitUrl }: VoiceRoomProps) {
  const {
    connectionState,
    transcript,
    interimText,
    metrics,
    audioLevels,
    connect,
    disconnect,
    userIdentity,
    agentIdentity,
    isReady,
  } = useVoiceAgent({
    livekitUrl,
    roomName: "voice-agent-room",
  });

  const isConnected = connectionState === "connected";
  const isConnecting = connectionState === "connecting";

  return (
  <div className="flex min-h-screen flex-col bg-background">
    
    {/* Header */}
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md">
  <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-5">
    
    {/* Left: Branding */}
    <div className="flex items-center gap-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 shadow-sm">
        <Mic className="h-5 w-5 text-white" />
      </div>

      <div className="leading-tight">
        <h1 className="text-base font-semibold tracking-tight text-gray-900">
          Voice Agent
        </h1>
        <p className="text-xs text-gray-500">
          Real-time voice agent via LiveKit
        </p>
      </div>
    </div>

    {/* Right: Action */}
    <Button
      onClick={isConnected ? disconnect : connect}
      disabled={isConnecting || !isReady}
      className={`inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-medium transition-all duration-200 ${
        isConnected
          ? "bg-red-50 text-red-600 hover:bg-red-100"
          : isConnecting || !isReady
          ? "bg-gray-100 text-gray-400 cursor-wait"
          : "bg-primary text-white shadow-sm hover:shadow-md hover:-translate-y-[1px]"
      }`}
    >
      {!isReady
        ? "Initializing..."
        : isConnecting
        ? "Connecting..."
        : isConnected
        ? "Disconnect"
        : "Connect"}
    </Button>
  </div>

  <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
</header>

    {/* Main Layout */}
    <main className="mx-auto flex w-full max-w-7xl flex-1 px-6 pb-6">
      <div className="flex h-[calc(100vh-120px)] w-full gap-6">

        {/* Left Panel */}
        <div className="w-[280px] flex-shrink-0 flex flex-col gap-4">
          <AudioVisualizer
            levels={audioLevels}
            connectionState={connectionState}
            userIdentity={userIdentity}
            agentIdentity={agentIdentity}
          />

          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              WebRTC Details
            </h3>
            <div className="flex flex-col gap-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Protocol</span>
                <span className="font-mono text-foreground">WebRTC / ICE</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Room</span>
                <span className="font-mono text-foreground">voice-agent-room</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tracks</span>
                <span className="font-mono text-foreground">
                  {isConnected ? "Audio (pub/sub)" : "None"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">STT Engine</span>
                <span className="font-mono text-foreground">Web Speech API</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">TTS Engine</span>
                <span className="font-mono text-foreground">SpeechSynthesis</span>
              </div>
            </div>
          </div>
        </div>

        {/* Center Panel — Always Expands */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <TranscriptPanel
            transcript={transcript}
            interimText={interimText}
            currentState={metrics.currentState}
          />
        </div>

        {/* Optional Metrics Panel — Only Takes Space If Rendered */}
        {/*
        <div className="w-[300px] flex-shrink-0 flex flex-col gap-4 overflow-y-auto">
          <MetricsPanel
            metrics={metrics}
            connectionState={connectionState}
          />
        </div>
        */}
        
      </div>
    </main>
  </div>
);
}
