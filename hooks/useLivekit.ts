import { useRef, useState } from "react"
import { Room, RoomEvent, createLocalAudioTrack, LocalAudioTrack } from "livekit-client"

export function useLiveKit() {
  const roomRef = useRef<Room | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [localTrack, setLocalTrack] = useState<LocalAudioTrack | null>(null)

  const connect = async (url: string, token: string) => {
    const room = new Room()
    roomRef.current = room

    room.on(RoomEvent.Connected, async () => {
      const micTrack = await createLocalAudioTrack()
      await room.localParticipant.publishTrack(micTrack)

      setLocalTrack(micTrack)
      setIsConnected(true)
    })

    room.on(RoomEvent.Disconnected, () => {
      setIsConnected(false)
      setLocalTrack(null)
    })

    await room.connect(url, token)
  }

  const disconnect = async () => {
    await roomRef.current?.disconnect()
    roomRef.current = null
    setIsConnected(false)
    setLocalTrack(null)
  }

  return { connect, disconnect, isConnected, localTrack }
}