/**
 * PROPOSED, UNAPPROVED question → signal mapping (open approval item #1 in the backend spec).
 * Kept only so Jana can review it. The scoring engine must NOT read this file.
 * When approved, copy the agreed mapping into an approved config with a new scoring version.
 */
import type { SignalTag } from "@/content/types";

export const PROPOSED_CONSTRUCT_MAP: Record<string, SignalTag> = {
  "mind.01": "AGENCY", "mind.02": "RELATIONSHIP", "mind.03": "RELATIONSHIP", "mind.04": "AGENCY",
  "mind.05": "REALITY", "mind.06": "RELATIONSHIP", "mind.07": "INNER_STATE",
  "body.01": "REALITY", "body.02": "REALITY", "body.03": "REALITY", "body.04": "RELATIONSHIP",
  "body.05": "INNER_STATE", "body.06": "RELATIONSHIP", "body.07": "INNER_STATE",
  "restoration.01": "REALITY", "restoration.02": "REALITY", "restoration.03": "AGENCY",
  "restoration.04": "REALITY", "restoration.05": "RELATIONSHIP", "restoration.06": "INNER_STATE",
  "growth.01": "REALITY", "growth.02": "RELATIONSHIP", "growth.03": "INNER_STATE",
  "growth.04": "AGENCY", "growth.05": "RELATIONSHIP", "growth.06": "AGENCY",
  "love.01": "RELATIONSHIP", "love.02": "AGENCY", "love.03": "REALITY",
  "love.04": "RELATIONSHIP", "love.05": "RELATIONSHIP", "love.06": "INNER_STATE",
  "social.01": "REALITY", "social.02": "REALITY", "social.03": "RELATIONSHIP", "social.04": "REALITY",
  "social.05": "AGENCY", "social.06": "INNER_STATE", "social.07": "RELATIONSHIP",
  "resources.01": "RELATIONSHIP", "resources.02": "REALITY", "resources.03": "REALITY",
  "resources.04": "AGENCY", "resources.05": "AGENCY", "resources.06": "REALITY",
  "joy.01": "REALITY", "joy.02": "INNER_STATE", "joy.03": "REALITY",
  "joy.04": "AGENCY", "joy.05": "RELATIONSHIP", "joy.06": "AGENCY",
};

/** Proposed SELF_CONGRUENCE evidence items (unapproved). */
export const PROPOSED_SELF_CONGRUENCE_ITEMS = ["mind.03", "growth.05", "love.01", "love.05", "social.03", "joy.05", "joy.06"];
