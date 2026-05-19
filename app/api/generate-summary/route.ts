import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured." },
      { status: 500 },
    );
  }

  const body = await req.json();
  const artistName: string = body.artistName ?? "the artist";
  const calculation = body.calculation ?? {};

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: `Write a 3–4 sentence plain English settlement summary for the tour manager. This gets read at 2am, so be direct and specific — lead with the dollar amount, explain how you got there, and call out anything to double-check. No headers, no bullet points, just a short paragraph.

Artist: ${artistName}

Settlement calculation:
${JSON.stringify(calculation, null, 2)}

Write only the summary paragraph.`,
      },
    ],
  });

  const summary =
    response.content[0].type === "text" ? response.content[0].text.trim() : "";

  return NextResponse.json({ summary });
}
