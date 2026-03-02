"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  Track,
  LocalTrackPublication,
  RemoteTrack,
  RemoteTrackPublication,
  RemoteParticipant,
  ConnectionState,
} from "livekit-client";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface TranscriptEntry {
  id: string;
  speaker: "user" | "agent";
  text: string;
  timestamp: number;
  isFinal: boolean;
}

export interface Metrics {
  connectionTime: number;
  sttFinalizationTime: number;
  timeToFirstResponse: number;
  ttsDuration: number;
  totalRoundtrip: number;
  currentState: string;
  audioLevel: number;
  silenceCountdown: number;
}

interface UseVoiceAgentOptions {
  livekitUrl: string;
  roomName: string;
}

const AGENT_IDENTITY = "echo-agent";
const SILENCE_TIMEOUT_MS = 20_000;

// ─── Barge-in tuning ──────────────────────────────────────────────────────────
// We use the raw microphone analyser which stays active even when Chrome
// suspends SpeechRecognition during TTS playback. The threshold is set high
// enough to reject TTS speaker bleed into the mic, and requires sustained
// frames (roughly 500ms) to trigger.
const BARGE_IN_THRESHOLD = 0.15;
const BARGE_IN_FRAMES_REQUIRED = 30; // ~500ms at 60fps
// After TTS begins, suppress barge-in for this window to ignore the initial
// speaker pop / bleed through the mic.
const BARGE_IN_GRACE_MS = 1200;

// Debounce for STT finalization — allows pauses while thinking/speaking slowly
const STT_FINALIZE_DEBOUNCE_MS = 1500;

function generateUserId(): string {
  return "user-" + Math.random().toString(36).slice(2, 8);
}

export function useVoiceAgent({ livekitUrl, roomName }: UseVoiceAgentOptions) {
  // ─── Stable identity: generated once on mount ─────────────────────────────
  const userIdRef = useRef<string>("");
  const [userId, setUserId] = useState("user-pending");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!userIdRef.current) {
      userIdRef.current = generateUserId();
      setUserId(userIdRef.current);
    }
    setIsReady(true);
  }, []);

  // ─── State ────────────────────────────────────────────────────────────────
  const [connectionState, setConnectionState] = useState<string>("disconnected");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [interimText, setInterimText] = useState("");
  const [metrics, setMetrics] = useState<Metrics>({
    connectionTime: 0,
    sttFinalizationTime: 0,
    timeToFirstResponse: 0,
    ttsDuration: 0,
    totalRoundtrip: 0,
    currentState: "idle",
    audioLevel: 0,
    silenceCountdown: SILENCE_TIMEOUT_MS / 1000,
  });
  const [audioLevels, setAudioLevels] = useState<number[]>(new Array(64).fill(0));

  // ─── Refs ─────────────────────────────────────────────────────────────────
  const roomRef = useRef<Room | null>(null);
  const agentRoomRef = useRef<Room | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const agentPublicationRef = useRef<LocalTrackPublication | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const silencePromptedRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const sttStartRef = useRef(0);
  const roundtripStartRef = useRef(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number>(0);
  const connectedRef = useRef(false);
  const connectingRef = useRef(false);
  const bargeInFrameCountRef = useRef(0);
  const ttsStartedAtRef = useRef(0);
  const voicesLoadedRef = useRef(false);
  const disconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep a ref to the raw mic MediaStream so we can build an analyser
  // that is completely independent of SpeechRecognition.
  const rawMicStreamRef = useRef<MediaStream | null>(null);

  // Debounce STT
  const pendingFinalTextRef = useRef("");
  const finalizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Metrics helper ───────────────────────────────────────────────────────
  const updateMetrics = useCallback((partial: Partial<Metrics>) => {
    setMetrics((prev) => ({ ...prev, ...partial }));
  }, []);

  // ─── Add transcript entry ─────────────────────────────────────────────────
  const addTranscript = useCallback(
    (speaker: "user" | "agent", text: string, isFinal: boolean) => {
      setTranscript((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          speaker,
          text,
          timestamp: Date.now(),
          isFinal,
        },
      ]);
    },
    []
  );

  // ─── Cancel TTS (barge-in) ────────────────────────────────────────────────
  const cancelTTS = useCallback(() => {
    if (!isSpeakingRef.current) return;
    console.log("[v0] cancelTTS: barge-in triggered");

    window.speechSynthesis.cancel();
    isSpeakingRef.current = false;
    bargeInFrameCountRef.current = 0;
    ttsStartedAtRef.current = 0;

    // Unpublish agent signal track
    if (agentPublicationRef.current && roomRef.current) {
      const track = agentPublicationRef.current.track;
      if (track) {
        roomRef.current.localParticipant
          .unpublishTrack(track.mediaStreamTrack)
          .catch(() => {});
      }
      agentPublicationRef.current = null;
    }

    updateMetrics({ currentState: "listening" });
  }, [updateMetrics]);

  // ─── Reset silence timer ──────────────────────────────────────────────────
  const resetSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (silenceCountdownRef.current) clearInterval(silenceCountdownRef.current);
    // silencePromptedRef.current = false;

    let countdown = SILENCE_TIMEOUT_MS / 1000;
    updateMetrics({ silenceCountdown: countdown });

    silenceCountdownRef.current = setInterval(() => {
      countdown -= 1;
      updateMetrics({ silenceCountdown: Math.max(0, countdown) });
    }, 1000);

    silenceTimerRef.current = setTimeout(() => {
      if (silenceCountdownRef.current) clearInterval(silenceCountdownRef.current);
      if (!silencePromptedRef.current && connectedRef.current) {
        silencePromptedRef.current = true;
        updateMetrics({ silenceCountdown: 0, currentState: "silence-prompt" });
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        speakResponse("Are you still there?");
      }
    }, SILENCE_TIMEOUT_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateMetrics]);

  // ─── Get best voice ───────────────────────────────────────────────────────
  const getBestVoice = useCallback((): SpeechSynthesisVoice | null => {
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;
    const preferred = voices.find(
      (v) =>
        v.lang.startsWith("en") &&
        (v.name.includes("Google") ||
          v.name.includes("Samantha") ||
          v.name.includes("Daniel") ||
          v.name.includes("Karen") ||
          v.name.includes("Moira"))
    );
    if (preferred) return preferred;
    const english = voices.find((v) => v.lang.startsWith("en"));
    return english || voices[0] || null;
  }, []);

  // ─── TTS: Speak response ─────────────────────────────────────────────────
  const speakResponse = useCallback(
    (text: string) => {
      if (!connectedRef.current) return;

      const ttsStart = performance.now();
      updateMetrics({ currentState: "agent-speaking" });
      isSpeakingRef.current = true;
      bargeInFrameCountRef.current = 0;
      ttsStartedAtRef.current = performance.now();

      // Cancel any queued speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      const voice = getBestVoice();
      if (voice) utterance.voice = voice;

      // Publish a near-silent signal track so the agent participant has a
      // visible audio track inside the LiveKit room, demonstrating real
      // WebRTC publish/subscribe flow.
      let signalAudioCtx: AudioContext | null = null;
      let oscillator: OscillatorNode | null = null;
      let signalTrack: MediaStreamTrack | null = null;

      try {
        signalAudioCtx = new AudioContext();
        oscillator = signalAudioCtx.createOscillator();
        const gainNode = signalAudioCtx.createGain();
        gainNode.gain.value = 0.001;
        oscillator.connect(gainNode);
        const dest = signalAudioCtx.createMediaStreamDestination();
        gainNode.connect(dest);
        oscillator.start();
        signalTrack = dest.stream.getAudioTracks()[0];
      } catch {
        /* proceed without signal track */
      }

      utterance.onstart = () => {
        const ttfr = performance.now() - roundtripStartRef.current;
        updateMetrics({ timeToFirstResponse: ttfr });
        console.log("[v0] TTS started, ttfr:", ttfr.toFixed(1), "ms");
      };

      const cleanup = () => {
        try {
          oscillator?.stop();
        } catch {
          /* empty */
        }
        signalAudioCtx?.close().catch(() => {});
        if (signalTrack) signalTrack.stop();

        if (agentPublicationRef.current && roomRef.current) {
          const track = agentPublicationRef.current.track;
          if (track) {
            roomRef.current.localParticipant
              .unpublishTrack(track.mediaStreamTrack)
              .catch(() => {});
          }
          agentPublicationRef.current = null;
        }
      };

      utterance.onend = () => {
        if (!isSpeakingRef.current) return; // Already cancelled via barge-in
        const ttsDuration = performance.now() - ttsStart;
        const totalRoundtrip = performance.now() - roundtripStartRef.current;
        updateMetrics({ ttsDuration, totalRoundtrip, currentState: "listening" });
        isSpeakingRef.current = false;
        ttsStartedAtRef.current = 0;
        cleanup();
        resetSilenceTimer();
        console.log("[v0] TTS ended naturally. Duration:", ttsDuration.toFixed(1), "ms");
      };

      utterance.onerror = () => {
        if (!isSpeakingRef.current) return;
        isSpeakingRef.current = false;
        ttsStartedAtRef.current = 0;
        updateMetrics({ currentState: "listening" });
        cleanup();
        console.log("[v0] TTS error");
      };

      // Publish signal track
      if (signalTrack && roomRef.current) {
        roomRef.current.localParticipant
          .publishTrack(signalTrack, { name: "agent-tts-signal" })
          .then((pub) => {
            agentPublicationRef.current = pub;
          })
          .catch(() => {});
      }

      window.speechSynthesis.speak(utterance);
    },
    [updateMetrics, resetSilenceTimer, getBestVoice]
  );

  // ─── Process finalized user speech (after debounce) ───────────────────────
  const processUserSpeech = useCallback(
    (text: string) => {
      const sttTime = performance.now() - sttStartRef.current;
      updateMetrics({ sttFinalizationTime: sttTime, currentState: "processing" });

      roundtripStartRef.current = performance.now();

      const response = `You said: ${text}`;
      addTranscript("user", text, true);
      addTranscript("agent", response, true);
      setInterimText("");

      speakResponse(response);
    },
    [addTranscript, speakResponse, updateMetrics]
  );

  const flushPendingFinal = useCallback(() => {
    const text = pendingFinalTextRef.current.trim();
    if (text) processUserSpeech(text);
    pendingFinalTextRef.current = "";
  }, [processUserSpeech]);

  const scheduleFinalFlush = useCallback(() => {
    if (finalizeTimerRef.current) clearTimeout(finalizeTimerRef.current);
    finalizeTimerRef.current = setTimeout(
      () => flushPendingFinal(),
      STT_FINALIZE_DEBOUNCE_MS
    );
  }, [flushPendingFinal]);

  // ─── Audio analyser (independent from STT) ───────────────────────────────
  // We obtain a mic MediaStream via getUserMedia directly rather than relying
  // on the LiveKit track. This stream stays active even when Chrome suspends
  // the SpeechRecognition engine during TTS playback. The analyser powers
  // the visualizer AND the audio-level based barge-in.
  const setupAudioAnalyser = useCallback(
    (stream: MediaStream) => {
      const ctx = new AudioContext();
      audioContextRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.4;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        if (!connectedRef.current) return;

        analyser.getByteFrequencyData(dataArray);
        const levels = Array.from(dataArray).map((v) => v / 255);
        setAudioLevels(levels);

        const avg = levels.reduce((a, b) => a + b, 0) / levels.length;
        updateMetrics({ audioLevel: avg });

        // ─── Audio-level barge-in ─────────────────────────────────────
        if (isSpeakingRef.current) {
          const now = performance.now();
          const inGracePeriod =
            ttsStartedAtRef.current > 0 &&
            now - ttsStartedAtRef.current < BARGE_IN_GRACE_MS;

          if (!inGracePeriod && avg > BARGE_IN_THRESHOLD) {
            bargeInFrameCountRef.current += 1;
            if (bargeInFrameCountRef.current >= BARGE_IN_FRAMES_REQUIRED) {
              console.log(
                "[v0] Audio-level barge-in triggered. avg:",
                avg.toFixed(3),
                "frames:",
                bargeInFrameCountRef.current
              );
              cancelTTS();
              addTranscript("agent", "[interrupted]", true);
              resetSilenceTimer();
              bargeInFrameCountRef.current = 0;
            }
          } else if (!inGracePeriod) {
            // Only reset counter if outside grace period — during grace we
            // just ignore everything.
            bargeInFrameCountRef.current = 0;
          }
        } else {
          bargeInFrameCountRef.current = 0;
        }

        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    },
    [updateMetrics, cancelTTS, addTranscript, resetSilenceTimer]
  );

  // ─── Setup STT ────────────────────────────────────────────────────────────
  const setupSTT = useCallback(() => {
    const SpeechRecognitionCtor =
      (window as unknown as { SpeechRecognition?: typeof window.SpeechRecognition })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: typeof window.SpeechRecognition })
        .webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // During TTS, Chrome may still fire old/stale results. If the agent
      // is speaking, we use the STT result as a secondary barge-in signal
      // but only if the text is substantial and outside the grace window.
      if (isSpeakingRef.current) {
        const now = performance.now();
        const inGracePeriod =
          ttsStartedAtRef.current > 0 &&
          now - ttsStartedAtRef.current < BARGE_IN_GRACE_MS;

        if (!inGracePeriod) {
          let hasSubstantialSpeech = false;
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const t = event.results[i][0].transcript.trim();
            if (t.length > 3 && event.results[i][0].confidence > 0.6) {
              hasSubstantialSpeech = true;
              break;
            }
          }
          if (hasSubstantialSpeech) {
            console.log("[v0] STT barge-in triggered");
            cancelTTS();
            addTranscript("agent", "[interrupted]", true);
            pendingFinalTextRef.current = "";
            if (finalizeTimerRef.current) clearTimeout(finalizeTimerRef.current);
          }
        }
        // Either way don't process speech for response while agent speaking
        resetSilenceTimer();
        return;
      }

      resetSilenceTimer();

      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const finalChunk = result[0].transcript.trim();
          if (finalChunk) {
            if (!pendingFinalTextRef.current) {
              sttStartRef.current = performance.now();
            }
            pendingFinalTextRef.current +=
              (pendingFinalTextRef.current ? " " : "") + finalChunk;
            scheduleFinalFlush();
          }
        } else {
          interim += result[0].transcript;
        }
      }

      if (interim) {
        setInterimText(
          pendingFinalTextRef.current
            ? pendingFinalTextRef.current + " " + interim
            : interim
        );
        updateMetrics({ currentState: "user-speaking" });
      } else if (pendingFinalTextRef.current) {
        setInterimText(pendingFinalTextRef.current + "...");
        updateMetrics({ currentState: "user-speaking" });
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "no-speech" || event.error === "aborted") {
        try {
          recognition.stop();
        } catch {
          /* empty */
        }
        setTimeout(() => {
          if (connectedRef.current) {
            try {
              recognition.start();
            } catch {
              /* empty */
            }
          }
        }, 500);
      }
    };

    recognition.onend = () => {
      if (connectedRef.current) {
        setTimeout(() => {
          try {
            recognition.start();
          } catch {
            /* empty */
          }
        }, 300);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [cancelTTS, addTranscript, scheduleFinalFlush, resetSilenceTimer, updateMetrics]);

  // ─── Prewarm voices ───────────────────────────────────────────────────────
  const prewarmVoices = useCallback(() => {
    return new Promise<void>((resolve) => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        voicesLoadedRef.current = true;
        resolve();
        return;
      }
      const handler = () => {
        voicesLoadedRef.current = true;
        window.speechSynthesis.removeEventListener("voiceschanged", handler);
        resolve();
      };
      window.speechSynthesis.addEventListener("voiceschanged", handler);
      setTimeout(() => {
        if (!voicesLoadedRef.current) {
          voicesLoadedRef.current = true;
          window.speechSynthesis.removeEventListener("voiceschanged", handler);
          resolve();
        }
      }, 2000);
    });
  }, []);

  // ─── Connect ──────────────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    if (roomRef.current || connectingRef.current || !userIdRef.current) return;
    connectingRef.current = true;

    const connectStart = performance.now();
    updateMetrics({ currentState: "connecting" });
    setConnectionState("connecting");

    try {
      // Get a raw mic stream FIRST — this is independent of LiveKit and
      // will remain active during TTS playback, powering our barge-in
      // audio level detection.
      const rawMicStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      rawMicStreamRef.current = rawMicStream;

      // Fetch tokens + prewarm voices in parallel
      const [userTokenRes, agentTokenRes] = await Promise.all([
        fetch("/api/livekit-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identity: userIdRef.current, room: roomName }),
        }),
        fetch("/api/livekit-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identity: AGENT_IDENTITY, room: roomName }),
        }),
        prewarmVoices(),
      ]);

      const { token: userToken } = await userTokenRes.json();
      const { token: agentToken } = await agentTokenRes.json();

      // Create user room
      const room = new Room({ adaptiveStream: true, dynacast: true });

      room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
        setConnectionState(state);
      });

      room.on(
        RoomEvent.TrackSubscribed,
        (
          track: RemoteTrack,
          _pub: RemoteTrackPublication,
          participant: RemoteParticipant
        ) => {
          if (participant.identity === AGENT_IDENTITY) return;
          if (track.kind === Track.Kind.Audio) {
            const el = track.attach();
            el.id = `remote-audio-${participant.identity}`;
            document.body.appendChild(el);
          }
        }
      );

      room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        track.detach().forEach((el) => el.remove());
      });

      await room.connect(livekitUrl, userToken);
      roomRef.current = room;
      connectedRef.current = true;

      const connectionTime = performance.now() - connectStart;
      updateMetrics({ connectionTime, currentState: "publishing-mic" });

      // Prewarm TTS engine with a silent utterance
      const warmup = new SpeechSynthesisUtterance("");
      warmup.volume = 0;
      window.speechSynthesis.speak(warmup);

      // Publish user microphone
      await room.localParticipant.setMicrophoneEnabled(true);
      updateMetrics({ currentState: "listening" });
      setConnectionState("connected");

      // Setup audio analyser on the raw mic stream (NOT LiveKit track).
      // This stays active even when Chrome suspends SpeechRecognition
      // during TTS playback.
      setupAudioAnalyser(rawMicStream);

      // Start STT
      setupSTT();
      resetSilenceTimer();

      // Connect agent participant to the same room
      const agentRoom = new Room({ adaptiveStream: true, dynacast: true });

      agentRoom.on(
        RoomEvent.TrackSubscribed,
        (
          track: RemoteTrack,
          _pub: RemoteTrackPublication,
          participant: RemoteParticipant
        ) => {
          if (participant.identity === AGENT_IDENTITY) return;
          if (track.kind === Track.Kind.Audio) {
            const el = track.attach();
            el.id = `agent-subscribed-${participant.identity}`;
            el.volume = 0;
            document.body.appendChild(el);
          }
        }
      );

      agentRoom.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        track.detach().forEach((el) => el.remove());
      });

      await agentRoom.connect(livekitUrl, agentToken);
      agentRoomRef.current = agentRoom;

      console.log("[v0] Both participants connected to room:", roomName);
    } catch (err) {
      console.error("[v0] Connection failed:", err);
      updateMetrics({ currentState: "error" });
      setConnectionState("disconnected");
    } finally {
      connectingRef.current = false;
    }
  }, [
    livekitUrl,
    roomName,
    setupAudioAnalyser,
    setupSTT,
    resetSilenceTimer,
    updateMetrics,
    prewarmVoices,
  ]);

  // ─── Disconnect ───────────────────────────────────────────────────────────
  const disconnect = useCallback(() => {
    connectedRef.current = false;
    connectingRef.current = false;

    // Stop STT
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* empty */
      }
      recognitionRef.current = null;
    }

    // Cancel pending finalization
    if (finalizeTimerRef.current) clearTimeout(finalizeTimerRef.current);
    pendingFinalTextRef.current = "";

    // Cancel TTS
    window.speechSynthesis.cancel();
    isSpeakingRef.current = false;
    bargeInFrameCountRef.current = 0;
    ttsStartedAtRef.current = 0;

    // Unpublish agent track
    if (agentPublicationRef.current && roomRef.current) {
      const track = agentPublicationRef.current.track;
      if (track) {
        roomRef.current.localParticipant
          .unpublishTrack(track.mediaStreamTrack)
          .catch(() => {});
      }
      agentPublicationRef.current = null;
    }

    // Timers
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (silenceCountdownRef.current) clearInterval(silenceCountdownRef.current);

    // Audio
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
    audioContextRef.current = null;
    analyserRef.current = null;

    // Stop raw mic stream
    if (rawMicStreamRef.current) {
      rawMicStreamRef.current.getTracks().forEach((t) => t.stop());
      rawMicStreamRef.current = null;
    }

    // Disconnect rooms
    if (roomRef.current) {
      roomRef.current.disconnect(true);
      roomRef.current = null;
    }
    if (agentRoomRef.current) {
      agentRoomRef.current.disconnect(true);
      agentRoomRef.current = null;
    }

    setConnectionState("disconnected");
    setInterimText("");
    updateMetrics({
      currentState: "idle",
      audioLevel: 0,
      silenceCountdown: SILENCE_TIMEOUT_MS / 1000,
    });
    setAudioLevels(new Array(64).fill(0));
  }, [updateMetrics]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      connectedRef.current = false;
      connectingRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          /* empty */
        }
      }
      window.speechSynthesis.cancel();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (silenceCountdownRef.current) clearInterval(silenceCountdownRef.current);
      if (finalizeTimerRef.current) clearTimeout(finalizeTimerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
      if (rawMicStreamRef.current) {
        rawMicStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (roomRef.current) roomRef.current.disconnect(true);
      if (agentRoomRef.current) agentRoomRef.current.disconnect(true);
    };
  }, []);

  return {
    connectionState,
    transcript,
    interimText,
    metrics,
    audioLevels,
    connect,
    disconnect,
    userIdentity: userId,
    agentIdentity: AGENT_IDENTITY,
    isReady,
  };
}

