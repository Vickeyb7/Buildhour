import { answerQuestion } from "../../../lib/ask";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request) {
  try {
    const payload = await request.json().catch(() => ({}));
    const answer = await answerQuestion(typeof payload.question === "string" ? payload.question : "");
    return Response.json(answer);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The answer service failed.";
    return Response.json(
      { kind: "error", body: message, source_url: null, updated: null, chunks: [] },
      { status: 500 },
    );
  }
}
