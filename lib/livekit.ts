export const ROOM_NAME = "voice-agent-room"
export const AGENT_IDENTITY = "voice-agent-user"

export async function fetchToken(
  room: string,
  identity: string
): Promise<string> {
  const res = await fetch("/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ room, identity }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Failed to fetch token: ${error}`)
  }

  const data = await res.json()
  return data.token
}

export async function sendChatMessage(text: string): Promise<string> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Chat request failed: ${error}`)
  }

  const data = await res.json()
  return data.response
}
