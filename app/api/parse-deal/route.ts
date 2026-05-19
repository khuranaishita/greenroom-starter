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
  const dealNotes: string = body.dealNotes ?? "";

  if (!dealNotes.trim()) {
    return NextResponse.json({ error: "dealNotes is required." }, { status: 400 });
  }

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `You are a music industry settlement expert who reads deal memos for live music venues.

Parse these deal notes and extract the key financial terms. Return ONLY a valid JSON object — no explanation, no markdown fences.

Deal notes:
"""
${dealNotes}
"""

Return a JSON object with exactly these fields:
{
  "guarantee_amount": <number in dollars, or null if not found>,
  "artist_percentage": <number as 0–100, or null if not found>,
  "expense_cap": <number in dollars, or null if not found or uncapped>,
  "hospitality_cap": <number in dollars, or null if not found or uncapped>,
  "walkout_pot": <true if there is a walkout pot / door-split component, otherwise false>,
  "walkout_pot_threshold": <number in dollars above which artist gets 100%, or null if not applicable>,
  "bonus_conditions": <string describing any bonus triggers, or null if none>,
  "ambiguous_terms": <array of strings — each entry is one specific thing that is unclear, conflicting, or could be interpreted multiple ways. Be precise and actionable. Empty array if nothing is ambiguous.>
}`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  // Strip markdown code fences if the model wrapped the JSON
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json(
      { error: "AI returned malformed JSON.", raw: text },
      { status: 500 },
    );
  }
}
