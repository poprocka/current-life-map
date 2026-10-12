import type { AnswerValue, Question } from "@/content/types";
import { NOT_APPLICABLE } from "@/content/types";
import { ACTIVE_QUESTIONS } from "@/content/v10/question-bank";

export const TOTAL_STEPS = ACTIVE_QUESTIONS.length;

export function questionAt(step: number): Question {
  return ACTIVE_QUESTIONS[Math.max(0, Math.min(step, TOTAL_STEPS - 1))];
}

/** Overall progress, 0–1, counting answered questions (not position) so Back never inflates it. */
export function progress(answers: Record<string, AnswerValue | undefined>): number {
  const done = ACTIVE_QUESTIONS.filter((q) => isAnswered(q, answers[q.id])).length;
  return done / TOTAL_STEPS;
}

export function isAnswered(q: Question, a: AnswerValue | undefined): boolean {
  if (a === undefined) return false;
  if (Array.isArray(a)) return a.length > 0;
  return a.trim() !== "";
}

export function validate(q: Question, a: AnswerValue | undefined): string | null {
  if (q.responseType === "text") {
    if (!isAnswered(q, a)) return q.optional ? null : "Write a few words, or skip this question.";
    if (typeof a !== "string") return "That answer isn't valid.";
    if (q.maxLength && a.length > q.maxLength) return `Please keep this under ${q.maxLength} characters.`;
    return null;
  }
  if (!isAnswered(q, a)) {
    if (q.optional) return null;
    return q.responseType === "emotional_state" ? "Choose at least one, up to three." : "Choose the answer that is most true for you.";
  }
  const values = Array.isArray(a) ? a : [a as string];
  const allowed = new Set(q.options.map((o) => o.value));
  if (q.allowNotApplicable) allowed.add(NOT_APPLICABLE);
  if (!values.every((v) => allowed.has(v))) return "That answer isn't one of the options.";
  if (q.maxSelections && values.length > q.maxSelections) return `Choose up to ${q.maxSelections}.`;
  return null;
}

/** First unanswered required step — used when resuming. */
export function resumeStep(answers: Record<string, AnswerValue | undefined>): number {
  const i = ACTIVE_QUESTIONS.findIndex((q) => !q.optional && !isAnswered(q, answers[q.id]));
  return i === -1 ? TOTAL_STEPS - 1 : i;
}

export function isComplete(answers: Record<string, AnswerValue | undefined>): boolean {
  return ACTIVE_QUESTIONS.every((q) => q.optional || isAnswered(q, answers[q.id]));
}
