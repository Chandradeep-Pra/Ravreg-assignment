"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Room, RoomEvent } from "livekit-client"
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

  const smRef = useRef<StateMachine>(new StateMachine())
  const roomRef = useRef<Room | null>(null)
  const vadRef = useRef<VoiceActivityDetector | null>(null)
  const audioManagerRef = useRef<AudioManager | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)

    silenceTimerRef.current = setTimeout(() => {
      if (smRef.current.currentState === AgentState.LISTENING) {
        const am = audioManagerRef.current
        if (am) {
          smRef.current.transition(AgentState.SPEAKING)
          addEntry("agent", STILL_THERE_MSG)
          am.speak(STILL_THERE_MSG).then(() => {
            smRef.current.transition(AgentState.LISTENING)
          })
        }
      }
    }, SILENCE_TIMEOUT_MS)
  }, [addEntry])

  // 🔥 UPDATED FUNCTION WITH FALLBACK LOGIC
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

        sm.transition(AgentState.SPEAKING)

        if (am) {
          await am.speak(response)
          sm.transition(AgentState.LISTENING)
          resetSilenceTimer()
        }
      } catch (err) {
        console.error("Gemini failed, using fallback:", err)

        // ✅ Fallback: Repeat what user said
        const fallbackResponse = `You said ${text}`

        addEntry("agent", fallbackResponse)

        sm.transition(AgentState.SPEAKING)

        if (am) {
          await am.speak(fallbackResponse)
        }

        sm.transition(AgentState.LISTENING)
        resetSilenceTimer()
      } finally {
        processingRef.current = false
      }
    },
    [addEntry, resetSilenceTimer]
  )

  const handleConnect = useCallback(async () => {
    if (!AudioManager.isSupported()) {
      setError("Browser not supported. Use Chrome or Edge.")
      return
    }

    setIsConnecting(true)
    setError(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const token = await fetchToken(ROOM_NAME, AGENT_IDENTITY)
      const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL

      const room = new Room()
      roomRef.current = room

      if (livekitUrl) {
        await room.connect(livekitUrl, token)
        await room.localParticipant.setMicrophoneEnabled(true)
      }

      const vad = new VoiceActivityDetector({
        threshold: 12,
        silenceDurationMs: 1000,
        onSpeechStart: () => resetSilenceTimer(),
        onSpeechEnd: () => {},
      })

      await vad.connect(stream)
      vadRef.current = vad

      const monitor = () => {
        if (vadRef.current) {
          setAudioLevel(vadRef.current.getAudioLevel())
        }
        requestAnimationFrame(monitor)
      }
      monitor()

      const am = new AudioManager({
        onTranscript: (text, isFinal) => {
          if (isFinal && text.trim()) {
            processUserSpeech(text)
          } else {
            setInterimText(text)
          }
          resetSilenceTimer()
        },
        onSpeechDone: () => {},
        onRecognitionError: () => {},
      })

      am.initRecognition()
      am.startListening()
      audioManagerRef.current = am

      const sm = smRef.current
      sm.onStateChange = setAgentState
      sm.transition(AgentState.LISTENING)

      setIsConnected(true)
      resetSilenceTimer()
    } catch (err) {
      setError("Failed to connect")
    } finally {
      setIsConnecting(false)
    }
  }, [processUserSpeech, resetSilenceTimer])

  const handleDisconnect = useCallback(() => {
    silenceTimerRef.current && clearTimeout(silenceTimerRef.current)
    vadRef.current?.destroy()
    audioManagerRef.current?.destroy()
    roomRef.current?.disconnect()
    streamRef.current?.getTracks().forEach((t) => t.stop())

    smRef.current.reset()
    setIsConnected(false)
    setIsConnecting(false)
    setIsMuted(false)
    setAudioLevel(0)
    setInterimText("")
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

  useEffect(() => {
    return () => handleDisconnect()
  }, [handleDisconnect])

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between px-6 py-4 border-b">
        <div className="text-sm font-mono">
          {isConnected ? "Connected" : isConnecting ? "Connecting..." : "Disconnected"}
        </div>

        <div className="flex gap-2">
          {isConnected && (
            <Button variant="outline" size="icon" onClick={toggleMute}>
              {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
            </Button>
          )}

          <Button
            variant={isConnected ? "destructive" : "default"}
            onClick={isConnected ? handleDisconnect : handleConnect}
            disabled={isConnecting}
          >
            {isConnected ? <PhoneOff size={16} /> : <Phone size={16} />}
          </Button>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <div className="flex items-center justify-center p-8 lg:w-[400px]">
          <StateIndicator state={agentState} audioLevel={audioLevel} />
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <TranscriptLog entries={entries} interimText={interimText} />
        </div>
      </div>

      {error && (
        <div className="px-6 py-3 bg-red-100 text-red-600 text-sm">
          {error}
        </div>
      )}
    </div>
  )
}