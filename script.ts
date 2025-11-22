import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import axios from "axios";
import { nextThursday, set } from "date-fns";
import { createLumaEvent, getEventUrl } from "./create-luma-event";

const COVER_IMAGE_PATH = path.join(__dirname, "default-cover.png");

function loadCoverImage(): Buffer {
  if (!fs.existsSync(COVER_IMAGE_PATH)) {
    throw new Error(`Cover image not found: ${COVER_IMAGE_PATH}`);
  }
  return fs.readFileSync(COVER_IMAGE_PATH);
}

function getNextThursdayAt5pmUTC(): Date {
  const thursday = nextThursday(new Date());
  return set(thursday, { hours: 17, minutes: 0, seconds: 0, milliseconds: 0 });
}

async function main() {
  const title = process.argv[2];
  const description = process.argv[3] || "Mastra Workshop";
  const duration = parseInt(process.argv[4] || "60", 10);
  const meetingUrl = process.argv[5];

  if (!title) {
    console.error(
      "Usage: pnpm tsx script.ts <title> [description] [duration-in-minutes] [meetingUrl]",
    );
    process.exit(1);
  }

  const startAt = getNextThursdayAt5pmUTC();
  const coverImage = loadCoverImage();

  try {
    console.log(`Creating Luma event: "${title}"`);
    console.log(`Description: ${description}`);
    console.log(`Scheduled for: ${startAt.toISOString()}`);
    console.log(`Duration: ${duration} minutes`);

    const result = await createLumaEvent({
      title,
      description,
      startAt,
      duration,
      meetingUrl,
      coverImage,
    });

    const eventUrl = await getEventUrl(result.api_id);
    console.log(`\nLuma event created successfully!`);
    console.log(`Event URL: ${eventUrl}`);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(
        "Error creating event:",
        error.response?.data || error.message,
      );
    } else {
      console.error("Error creating event:", error);
    }
    process.exit(1);
  }
}

main();
