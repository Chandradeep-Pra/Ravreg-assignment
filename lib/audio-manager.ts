export interface AudioManagerOptions {
  lang?: string
  onTranscript?: (text: string, isFinal: boolean) => void
  onSpeechDone?: () => void
  onRecognitionError?: (error: string) => void
}

export class AudioManager {
  private recognition: SpeechRecognition | null = null
  private synthesis: SpeechSynthesis | null = null
  private currentUtterance: SpeechSynthesisUtterance | null = null
  private _isSpeaking = false
  private _isListening = false
  private shouldRestart = false

  private onTranscript?: (text: string, isFinal: boolean) => void
  private onSpeechDone?: () => void
  private onRecognitionError?: (error: string) => void
  private lang: string

  constructor(options: AudioManagerOptions = {}) {
    this.lang = options.lang ?? "en-US"
    this.onTranscript = options.onTranscript
    this.onSpeechDone = options.onSpeechDone
    this.onRecognitionError = options.onRecognitionError
  }

  get isSpeaking(): boolean {
    return this._isSpeaking
  }

  get isListening(): boolean {
    return this._isListening
  }

  static isSupported(): boolean {
    if (typeof window === "undefined") return false
    const hasSR =
      "SpeechRecognition" in window || "webkitSpeechRecognition" in window
    const hasSS = "speechSynthesis" in window
    return hasSR && hasSS
  }

  initRecognition(): void {
    if (typeof window === "undefined") return

    const SpeechRecognitionAPI =
      (window as unknown as { SpeechRecognition?: typeof SpeechRecognition })
        .SpeechRecognition ??
      (
        window as unknown as {
          webkitSpeechRecognition?: typeof SpeechRecognition
        }
      ).webkitSpeechRecognition

    if (!SpeechRecognitionAPI) {
      this.onRecognitionError?.("SpeechRecognition not supported")
      return
    }

    this.recognition = new SpeechRecognitionAPI()
    this.recognition.continuous = true
    this.recognition.interimResults = true
    this.recognition.lang = this.lang
    this.recognition.maxAlternatives = 1

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = ""
      let interimTranscript = ""

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalTranscript += result[0].transcript
        } else {
          interimTranscript += result[0].transcript
        }
      }

      if (finalTranscript) {
        this.onTranscript?.(finalTranscript.trim(), true)
      } else if (interimTranscript) {
        this.onTranscript?.(interimTranscript.trim(), false)
      }
    }

    this.recognition.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return
      this.onRecognitionError?.(event.error)
    }

    this.recognition.onend = () => {
      this._isListening = false
      if (this.shouldRestart) {
        setTimeout(() => {
          this.startListening()
        }, 100)
      }
    }

    this.synthesis = window.speechSynthesis
  }

  startListening(): void {
    if (!this.recognition) return
    this.shouldRestart = true
    try {
      this.recognition.start()
      this._isListening = true
    } catch {
      // Already started - ignore
    }
  }

  stopListening(): void {
    this.shouldRestart = false
    this._isListening = false
    try {
      this.recognition?.stop()
    } catch {
      // Already stopped - ignore
    }
  }

  speak(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (!this.synthesis) {
        resolve()
        return
      }

      this.cancelSpeaking()

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = this.lang
      utterance.rate = 1.0
      utterance.pitch = 1.0

      this.currentUtterance = utterance
      this._isSpeaking = true

      utterance.onend = () => {
        this._isSpeaking = false
        this.currentUtterance = null
        this.onSpeechDone?.()
        resolve()
      }

      utterance.onerror = () => {
        this._isSpeaking = false
        this.currentUtterance = null
        this.onSpeechDone?.()
        resolve()
      }

      this.synthesis.speak(utterance)
    })
  }

  cancelSpeaking(): void {
    if (this.synthesis) {
      this.synthesis.cancel()
    }
    this._isSpeaking = false
    this.currentUtterance = null
  }

  destroy(): void {
    this.shouldRestart = false
    this.stopListening()
    this.cancelSpeaking()
    this.recognition = null
    this.synthesis = null
  }
}
