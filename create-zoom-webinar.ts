import axios from "axios";

const ZOOM_ACCOUNT_ID = process.env.ZOOM_ACCOUNT_ID!;
const ZOOM_CLIENT_ID = process.env.ZOOM_CLIENT_ID!;
const ZOOM_CLIENT_SECRET = process.env.ZOOM_CLIENT_SECRET!;

interface ZoomTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface CreateWebinarParams {
  topic: string;
  startTime: Date;
  duration: number;
  agenda?: string;
}

interface ZoomWebinarResponse {
  id: number;
  join_url: string;
  start_url: string;
  registration_url?: string;
}

async function getZoomAccessToken(): Promise<string> {
  const credentials = Buffer.from(
    `${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`,
  ).toString("base64");

  const response = await axios.post<ZoomTokenResponse>(
    "https://zoom.us/oauth/token",
    new URLSearchParams({
      grant_type: "account_credentials",
      account_id: ZOOM_ACCOUNT_ID,
    }),
    {
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    },
  );

  return response.data.access_token;
}

async function createWebinar(params: CreateWebinarParams): Promise<string> {
  const { topic, startTime, duration, agenda } = params;

  const accessToken = await getZoomAccessToken();

  const response = await axios.post<ZoomWebinarResponse>(
    "https://api.zoom.us/v2/users/me/webinars",
    {
      topic,
      type: 5, // Scheduled webinar
      start_time: startTime.toISOString(),
      duration,
      timezone: "Europe/London",
      agenda,
      settings: {
        practice_session: true,
        host_video: true,
        panelists_video: true,
        approval_type: 0, // Automatically approve
        registration_type: 1, // Attendees register once and can attend any occurrence
        audio: "both",
        auto_recording: "none",
      },
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    },
  );

  return response.data.join_url;
}

export { createWebinar, CreateWebinarParams };
