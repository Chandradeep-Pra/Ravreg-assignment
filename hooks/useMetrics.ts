import { useState } from "react"

export interface Metrics {
  connectionTime: number
  sttFinalizationTime: number
  timeToFirstResponse: number
  ttsDuration: number
  totalRoundtrip: number
  currentState: string
  audioLevel: number
  silenceCountdown: number
  speechEnd: number
  ttsStart: number
  ttsEnd: number
  latency: number
}

const SILENCE_TIMEOUT_MS = 20_000

export function useMetrics() {
  const [data, setData] = useState<Metrics>({
    connectionTime: 0,
    sttFinalizationTime: 0,
    timeToFirstResponse: 0,
    ttsDuration: 0,
    totalRoundtrip: 0,
    currentState: "idle",
    audioLevel: 0,
    silenceCountdown: SILENCE_TIMEOUT_MS / 1000,
    speechEnd: 0,
    ttsStart: 0,
    ttsEnd: 0,
    latency: 0,
  })

  const update = (partial: Partial<Metrics>) =>
    setData((prev) => ({ ...prev, ...partial }))

  const markSpeechEnd = () =>
    setData((d) => ({
      ...d,
      speechEnd: performance.now(),
    }))

  const markTTSStart = () =>
    setData((d) => {
      const ttsStart = performance.now()
      return {
        ...d,
        ttsStart,
        latency: ttsStart - d.speechEnd,
      }
    })

  const markTTSEnd = () =>
    setData((d) => ({
      ...d,
      ttsEnd: performance.now(),
      ttsDuration: performance.now() - d.ttsStart,
      totalRoundtrip: performance.now() - d.speechEnd,
    }))

  return {
    data,
    update,
    markSpeechEnd,
    markTTSStart,
    markTTSEnd,
  }
}