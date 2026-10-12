import type { AnswerValue, OrbitId } from "@/content/types";
import { NOT_APPLICABLE } from "@/content/types";
import { questionById } from "@/content/v10/question-bank";
import { NOT_APPLICABLE_LABEL } from "@/content/v10/scales";
import type { EvidenceRef } from "@/engine/compute";

export type Answers = Record<string, AnswerValue | undefined>;

/** One statement in coach material. Every claim carries the question IDs it rests on. */
export interface CoachItem {
  id: string;
  text: string;
  evidence: EvidenceRef[];
  basis: "direct" | "derived" | "hypothesis" | "coach";
  /** Present whenever the item is an interpretation rather than a restatement. */
  uncertainty?: string;
}

/** Exact label of the respondent's answer to a question. */
export function answerLabel(questionId: string, a: AnswerValue | undefined): string {
  if (a === undefined) return "Not answered";
  const q = questionById(questionId);
  const one = (v: string) => (v === NOT_APPLICABLE ? NOT_APPLICABLE_LABEL : q?.options.find((o) => o.value === v)?.label ?? v);
  return Array.isArray(a) ? a.map(one).join(", ") : one(a);
}

export const promptOf = (questionId: string) => questionById(questionId)?.prompt ?? questionId;

export const quote = (questionId: string, answers: Answers) =>
  `“${promptOf(questionId)}” — ${answerLabel(questionId, answers[questionId])}`;

export const direct = (questionId: string, answers: Answers): EvidenceRef => ({
  questionId,
  answer: Array.isArray(answers[questionId]) ? (answers[questionId] as string[]).join(",") : String(answers[questionId] ?? ""),
  kind: "direct",
});

export const pct = (x: number | null) => (x === null ? "—" : x.toFixed(2));
export type { OrbitId };
