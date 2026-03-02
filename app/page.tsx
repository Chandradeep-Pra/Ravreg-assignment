import { VoiceRoom } from "@/components/voice-room";

export default function Page() {
  const livekitUrl = process.env.LIVEKIT_URL ?? "";

  return <VoiceRoom livekitUrl={livekitUrl} />;
}
