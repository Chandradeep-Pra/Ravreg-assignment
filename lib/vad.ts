export interface VADOptions {
  threshold?: number
  silenceDurationMs?: number
  onSpeechStart?: () => void
  onSpeechEnd?: () => void
}

export class VoiceActivityDetector {
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private dataArray: Uint8Array | null = null
  private rafId: number | null = null
  private isSpeaking = false
  private silenceStart: number | null = null

  private threshold: number
  private silenceDurationMs: number
  private onSpeechStart?: () => void
  private onSpeechEnd?: () => void

  constructor(options: VADOptions = {}) {
    this.threshold = options.threshold ?? 15
    this.silenceDurationMs = options.silenceDurationMs ?? 800
    this.onSpeechStart = options.onSpeechStart
    this.onSpeechEnd = options.onSpeechEnd
  }

  async connect(stream: MediaStream): Promise<void> {
    this.audioContext = new AudioContext()
    this.analyser = this.audioContext.createAnalyser()
    this.analyser.fftSize = 512
    this.analyser.smoothingTimeConstant = 0.8

    this.source = this.audioContext.createMediaStreamSource(stream)
    this.source.connect(this.analyser)

    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount)
    this.monitor()
  }

  private monitor = (): void => {
    if (!this.analyser || !this.dataArray) return

    this.analyser.getByteFrequencyData(this.dataArray)

    let sum = 0
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i]
    }
    const average = sum / this.dataArray.length

    if (average > this.threshold) {
      if (!this.isSpeaking) {
        this.isSpeaking = true
        this.onSpeechStart?.()
      }
      this.silenceStart = null
    } else {
      if (this.isSpeaking) {
        if (!this.silenceStart) {
          this.silenceStart = Date.now()
        } else if (Date.now() - this.silenceStart > this.silenceDurationMs) {
          this.isSpeaking = false
          this.silenceStart = null
          this.onSpeechEnd?.()
        }
      }
    }

    this.rafId = requestAnimationFrame(this.monitor)
  }

  getAudioLevel(): number {
    if (!this.analyser || !this.dataArray) return 0
    this.analyser.getByteFrequencyData(this.dataArray)
    let sum = 0
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i]
    }
    return sum / this.dataArray.length / 255
  }

  destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    this.source?.disconnect()
    this.analyser?.disconnect()
    if (this.audioContext?.state !== "closed") {
      this.audioContext?.close()
    }
    this.audioContext = null
    this.analyser = null
    this.source = null
    this.dataArray = null
  }
}
