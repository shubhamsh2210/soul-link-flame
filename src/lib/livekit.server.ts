import { AccessToken, RoomServiceClient } from "livekit-server-sdk";

function creds() {
  const apiKey = process.env["LIVEKIT_API_KEY"];
  const apiSecret = process.env["LIVEKIT_API_SECRET"];
  const url = process.env["LIVEKIT_URL"];
  if (!apiKey || !apiSecret || !url) throw new Error("LiveKit is not configured");
  return { apiKey, apiSecret, url };
}

export function roomNameFor(sessionId: string) {
  return `peerprep-${sessionId}`;
}

export async function mintRoomToken(
  sessionId: string,
  userId: string,
  displayName: string,
) {
  const { apiKey, apiSecret, url } = creds();
  const at = new AccessToken(apiKey, apiSecret, {
    identity: userId,
    name: displayName,
    ttl: "3h",
  });
  at.addGrant({
    room: roomNameFor(sessionId),
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });
  return { token: await at.toJwt(), url };
}

export async function countRoomParticipants(sessionId: string) {
  const { apiKey, apiSecret, url } = creds();
  const httpUrl = url.replace(/^ws/, "http");
  const client = new RoomServiceClient(httpUrl, apiKey, apiSecret);
  try {
    const participants = await client.listParticipants(roomNameFor(sessionId));
    return participants.length;
  } catch {
    return 0;
  }
}
