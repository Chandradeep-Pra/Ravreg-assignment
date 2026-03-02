import { useEffect, useRef, useState } from "react"

export function useSpeechToText() {
  const recognitionRef = useRef<any>(null)

  const [interimText, setInterimText] = useState("")
  const [finalText, setFinalText] = useState("")
  const [isListening, setIsListening] = useState(false)

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition

    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = "en-US"

    recognition.onresult = (event: any) => {
      let interim = ""
      let final = ""

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) final += transcript
        else interim += transcript
      }

      if (interim) setInterimText(interim)
      if (final) {
        setFinalText(final.trim())
        setInterimText("")
      }
    }

    recognitionRef.current = recognition
  }, [])

  const start = () => {
    recognitionRef.current?.start()
    setIsListening(true)
  }

  const stop = () => {
    recognitionRef.current?.stop()
    setIsListening(false)
  }

  return { start, stop, interimText, finalText, isListening }
}