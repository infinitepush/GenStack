import { jsonrepair } from "jsonrepair";

export interface JsonParseResult {
  value: unknown;
  repaired: boolean;
  source: string;
}

function extractJsonCandidate(text: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const firstObject = text.indexOf("{");
  const lastObject = text.lastIndexOf("}");
  if (firstObject >= 0 && lastObject > firstObject) {
    return text.slice(firstObject, lastObject + 1);
  }

  return text;
}

export function parsePossiblyBrokenJson(text: string): JsonParseResult {
  const source = extractJsonCandidate(text);

  try {
    return { value: JSON.parse(source) as unknown, repaired: false, source };
  } catch {
    const repairedText = jsonrepair(source);
    return { value: JSON.parse(repairedText) as unknown, repaired: true, source: repairedText };
  }
}
