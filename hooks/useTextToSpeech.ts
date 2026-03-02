// hooks/useTextToSpeech.ts
import { useState } from "react"

export function useTextToSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false)

  const speak = (text: string, onEnd?: () => void) => {
    window.speechSynthesis.cancel() // barge-in

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1
    utterance.pitch = 1

    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => {
      setIsSpeaking(false)
      onEnd?.()
    }

    window.speechSynthesis.speak(utterance)
  }

  const cancel = () => {
    window.speechSynthesis.cancel()
    setIsSpeaking(false)
  }

  return { speak, cancel, isSpeaking }
}