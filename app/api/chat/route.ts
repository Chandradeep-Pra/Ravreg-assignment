import { NextResponse } from "next/server"
import { GoogleGenAI } from "@google/genai"

const SYSTEM_PROMPT = `You are a helpful voice assistant. Keep responses concise and conversational (1-2 sentences max). Be friendly and natural. Do not use markdown or special formatting since your response will be spoken aloud.`

export async function POST(req: Request) {
  try {
    const { text } = await req.json()

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid text" },
        { status: 400 }
      )
    }

    const apiKey = process.env.GEMINI_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: "Gemini API key not configured" },
        { status: 500 }
      )
    }

    const ai = new GoogleGenAI({ apiKey })

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [{ text: `${SYSTEM_PROMPT}\n\nUser said: "${text}"` }],
        },
      ],
    })

    const responseText =
      response.text ?? "Sorry, I could not generate a response."

    return NextResponse.json({ response: responseText })
  } catch (error) {
    console.error("Chat error:", error)
    return NextResponse.json(
      { error: "Failed to generate response" },
      { status: 500 }
    )
  }
}
