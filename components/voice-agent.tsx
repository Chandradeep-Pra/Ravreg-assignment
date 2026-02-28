"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Room, RoomEvent, ConnectionState } from "livekit-client"
import { AgentState, StateMachine } from "@/lib/state-machine"
import { VoiceActivityDetector } from "@/lib/vad"
import { AudioManager } from "@/lib/audio-manager"
import { fetchToken, sendChatMessage, ROOM_NAME, AGENT_IDENTITY } from "@/lib/livekit"
import { StateIndicator } from "@/components/state-indicator"
import { TranscriptLog, type TranscriptEntry } from "@/components/transcript-log"
import { Button } from "@/components/ui/button"
import { Mic, MicOff, Phone, PhoneOff } from "lucide-react"

const SILENCE_TIMEOUT_MS = 20_000
const STILL_THERE_MSG = "Are you still there?"

export function VoiceAgent() {
  const [agentState, setAgentState] = useState<AgentState>(AgentState.IDLE)
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [entries, setEntries] = useState<TranscriptEntry[]>([])
  const [interimText, setInterimText] = useState("")
  const [audioLevel, setAudioLevel] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [connectionInfo, setConnectionInfo] = useState("")

  const smRef = useRef<StateMachine>(new StateMachine())
  const roomRef = useRef<Room | null>(null)
  const vadRef = useRef<VoiceActivityDetector | null>(null)
  const audioManagerRef = useRef<AudioManager | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stillThereAskedRef = useRef(false)
  const audioLevelRafRef = useRef<number | null>(null)
  const processingRef = useRef(false)

  const addEntry = useCallback((role: "user" | "agent", text: string) => {
    setEntries((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        role,
        text,
        timestamp: new Date(),
      },
    ])
  }, [])

  const resetSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
    }
    stillThereAskedRef.current = false
    silenceTimerRef.current = setTimeout(() => {
      if (
        smRef.current.currentState === AgentState.LISTENING &&
        !stillThereAskedRef.current
      ) {
        stillThereAskedRef.current = true
        // Speak "Are you still there?"
        const am = audioManagerRef.current
        if (am) {
          smRef.current.transition(AgentState.SPEAKING)
          addEntry("agent", STILL_THERE_MSG)
          am.speak(STILL_THERE_MSG).then(() => {
            if (smRef.current.currentState === AgentState.SPEAKING) {
              smRef.current.transition(AgentState.LISTENING)
            }
          })
        }
      }
    }, SILENCE_TIMEOUT_MS)
  }, [addEntry])

  const processUserSpeech = useCallback(
    async (text: string) => {
      if (processingRef.current) return
      processingRef.current = true

      const sm = smRef.current
      const am = audioManagerRef.current

      addEntry("user", text)
      setInterimText("")

      if (!sm.transition(AgentState.PROCESSING)) {
        processingRef.current = false
        return
      }

      try {
        const response = await sendChatMessage(text)
        addEntry("agent", response)

        if (sm.currentState !== AgentState.PROCESSING) {
          processingRef.current = false
          return
        }

        sm.transition(AgentState.SPEAKING)

        if (am) {
          await am.speak(response)
          if (sm.currentState === AgentState.SPEAKING) {
            sm.transition(AgentState.LISTENING)
            resetSilenceTimer()
          }
        }
      } catch (err) {
        console.error("Processing error:", err)
        const errorMsg = "Sorry, I had trouble processing that."
        addEntry("agent", errorMsg)

        if (am) {
          sm.transition(AgentState.SPEAKING)
          await am.speak(errorMsg)
        }
        if (
          sm.currentState === AgentState.SPEAKING ||
          sm.currentState === AgentState.PROCESSING
        ) {
          sm.transition(AgentState.LISTENING)
          resetSilenceTimer()
        }
      } finally {
        processingRef.current = false
      }
    },
    [addEntry, resetSilenceTimer]
  )

  const handleConnect = useCallback(async () => {
    if (!AudioManager.isSupported()) {
      setError(
        "Your browser does not support Web Speech API. Please use Chrome or Edge."
      )
      return
    }

    setIsConnecting(true)
    setError(null)

    try {
      // Get mic stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Fetch LiveKit token
      const token = await fetchToken(ROOM_NAME, AGENT_IDENTITY)
      const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL

      // Connect to LiveKit room
      const room = new Room()
      roomRef.current = room

      room.on(RoomEvent.Connected, () => {
        setConnectionInfo(`Room: ${ROOM_NAME}`)
      })

      room.on(RoomEvent.Disconnected, () => {
        setIsConnected(false)
        setConnectionInfo("")
      })

      if (livekitUrl) {
        await room.connect(livekitUrl, token)
        await room.localParticipant.setMicrophoneEnabled(true)
      }

      // Initialize VAD
      const vad = new VoiceActivityDetector({
        threshold: 12,
        silenceDurationMs: 1000,
        onSpeechStart: () => {
          // Interruption logic: if agent is speaking, cancel
          const sm = smRef.current
          const am = audioManagerRef.current
          if (sm.currentState === AgentState.SPEAKING && am) {
            am.cancelSpeaking()
            sm.transition(AgentState.LISTENING)
          }
          resetSilenceTimer()
        },
        onSpeechEnd: () => {
          // Speech end handled by SpeechRecognition final result
        },
      })
      await vad.connect(stream)
      vadRef.current = vad

      // Monitor audio levels for visualization
      const monitorAudioLevel = () => {
        if (vadRef.current) {
          setAudioLevel(vadRef.current.getAudioLevel())
        }
        audioLevelRafRef.current = requestAnimationFrame(monitorAudioLevel)
      }
      monitorAudioLevel()

      // Initialize AudioManager
      const am = new AudioManager({
        onTranscript: (text, isFinal) => {
          if (isFinal) {
            setInterimText("")
            if (text.trim().length > 0) {
              processUserSpeech(text)
            }
          } else {
            setInterimText(text)
          }
          resetSilenceTimer()
        },
        onSpeechDone: () => {
          // TTS finished callback
        },
        onRecognitionError: (err) => {
          console.warn("Recognition error:", err)
        },
      })
      am.initRecognition()
      am.startListening()
      audioManagerRef.current = am

      // Set initial state
      const sm = smRef.current
      sm.onStateChange = (newState) => {
        setAgentState(newState)
      }
      sm.transition(AgentState.LISTENING)

      setIsConnected(true)
      if (!livekitUrl) {
        setConnectionInfo("Local mode (no LiveKit URL)")
      }
      resetSilenceTimer()
    } catch (err) {
      console.error("Connection error:", err)
      setError(
        err instanceof Error ? err.message : "Failed to connect"
      )
    } finally {
      setIsConnecting(false)
    }
  }, [processUserSpeech, resetSilenceTimer])

  const handleDisconnect = useCallback(() => {
    // Cleanup audio level monitor
    if (audioLevelRafRef.current !== null) {
      cancelAnimationFrame(audioLevelRafRef.current)
      audioLevelRafRef.current = null
    }

    // Cleanup silence timer
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }

    // Cleanup VAD
    vadRef.current?.destroy()
    vadRef.current = null

    // Cleanup AudioManager
    audioManagerRef.current?.destroy()
    audioManagerRef.current = null

    // Disconnect LiveKit room
    roomRef.current?.disconnect()
    roomRef.current = null

    // Stop media stream
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null

    // Reset state
    smRef.current.reset()
    setIsConnected(false)
    setIsConnecting(false)
    setIsMuted(false)
    setAudioLevel(0)
    setInterimText("")
    setConnectionInfo("")
    processingRef.current = false
  }, [])

  const toggleMute = useCallback(() => {
    const stream = streamRef.current
    if (!stream) return

    const track = stream.getAudioTracks()[0]
    if (track) {
      track.enabled = !track.enabled
      setIsMuted(!track.enabled)
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      handleDisconnect()
    }
  }, [handleDisconnect])

  return (
    <div className="flex flex-col h-full">
      {/* Header controls */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div
              className={`size-2 rounded-full ${
                isConnected ? "bg-agent-listening" : "bg-agent-idle"
              }`}
            />
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
              {isConnected
                ? connectionInfo || "Connected"
                : isConnecting
                  ? "Connecting..."
                  : "Disconnected"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isConnected && (
            <Button
              variant="outline"
              size="icon"
              onClick={toggleMute}
              className="border-border"
              aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
            >
              {isMuted ? (
                <MicOff className="size-4 text-destructive" />
              ) : (
                <Mic className="size-4 text-foreground" />
              )}
            </Button>
          )}

          <Button
            variant={isConnected ? "destructive" : "default"}
            onClick={isConnected ? handleDisconnect : handleConnect}
            disabled={isConnecting}
            className="gap-2"
          >
            {isConnected ? (
              <>
                <PhoneOff className="size-4" />
                <span className="hidden sm:inline">Disconnect</span>
              </>
            ) : (
              <>
                <Phone className="size-4" />
                <span>{isConnecting ? "Connecting..." : "Connect"}</span>
              </>
            )}
          </Button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left panel: State indicator */}
        <div className="flex items-center justify-center p-8 lg:w-[400px] lg:border-r lg:border-border">
          <StateIndicator state={agentState} audioLevel={audioLevel} />
        </div>

        {/* Right panel: Transcript */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Transcript
            </h2>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <TranscriptLog entries={entries} interimText={interimText} />
          </div>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="px-6 py-3 bg-destructive/10 border-t border-destructive/20">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Browser notice */}
      {!isConnected && !error && (
        <div className="px-6 py-3 border-t border-border">
          <p className="text-xs text-muted-foreground font-mono text-center">
            Requires Chrome or Edge for Web Speech API. Microphone access needed.
          </p>
        </div>
      )}
    </div>
  )
}
