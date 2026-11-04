import { answerQuestion } from "../../../lib/ask";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request) {
  const payload = await request.json().catch(() => ({}));
  const answer = await answerQuestion(typeof payload.question === "string" ? payload.question : "");
  return Response.json(answer);
}
