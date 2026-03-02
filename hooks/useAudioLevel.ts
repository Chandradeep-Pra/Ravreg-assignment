import { useEffect, useState } from "react"
import { LocalAudioTrack } from "livekit-client"

export function useAudioLevels(track: LocalAudioTrack | null) {
  const [level, setLevel] = useState(0)

  useEffect(() => {
    if (!track) return

    const context = new AudioContext()
    const source = context.createMediaStreamSource(
      new MediaStream([track.mediaStreamTrack])
    )

    const analyser = context.createAnalyser()
    analyser.fftSize = 256

    source.connect(analyser)

    const dataArray = new Uint8Array(analyser.frequencyBinCount)

    let rafId: number

    const update = () => {
      analyser.getByteTimeDomainData(dataArray)

      let sum = 0
      for (let i = 0; i < dataArray.length; i++) {
        const value = (dataArray[i] - 128) / 128
        sum += value * value
      }

      const rms = Math.sqrt(sum / dataArray.length)
      setLevel(rms)

      rafId = requestAnimationFrame(update)
    }

    update()

    return () => {
      cancelAnimationFrame(rafId)
      context.close()
    }
  }, [track])

  return level
}