import { NextResponse } from "next/server"
import { AccessToken } from "livekit-server-sdk"

export async function POST(req: Request) {
  try {
    const { room, identity } = await req.json()

    if (!room || !identity) {
      return NextResponse.json(
        { error: "Missing room or identity" },
        { status: 400 }
      )
    }

    const apiKey = process.env.LIVEKIT_API_KEY
    const apiSecret = process.env.LIVEKIT_API_SECRET

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { error: "LiveKit credentials not configured" },
        { status: 500 }
      )
    }

    const token = new AccessToken(apiKey, apiSecret, {
      identity,
      ttl: "10m",
    })

    token.addGrant({
      roomJoin: true,
      room,
      canPublish: true,
      canSubscribe: true,
    })

    const jwt = await token.toJwt()

    return NextResponse.json({ token: jwt })
  } catch (error) {
    console.error("Token generation error:", error)
    return NextResponse.json(
      { error: "Failed to generate token" },
      { status: 500 }
    )
  }
}
