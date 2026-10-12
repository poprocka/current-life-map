"use client";
import type { AnswerValue, OrbitId, Question } from "@/content/types";
import { NOT_APPLICABLE } from "@/content/types";
import { NOT_APPLICABLE_LABEL } from "@/content/v10/scales";
import { ORBIT_TINT } from "./LifeSystem";

export function ResponseControl({
  q,
  value,
  onChange,
  labelledBy,
}: {
  q: Question;
  value: AnswerValue | undefined;
  onChange: (v: AnswerValue | undefined) => void;
  labelledBy: string;
}) {
  const multi = q.responseType === "emotional_state";
  const selected = new Set(Array.isArray(value) ? value : value ? [value] : []);
  const name = `q-${q.id}`;
  const isOrbit = q.responseType === "orbit_select";

  const toggle = (v: string) => {
    if (!multi) return onChange(v);
    const next = new Set(selected);
    if (next.has(v)) next.delete(v);
    else if (!q.maxSelections || next.size < q.maxSelections) next.add(v);
    onChange(next.size ? [...next] : undefined);
  };

  return (
    <div role={multi ? "group" : "radiogroup"} aria-labelledby={labelledBy}>
      <div className={isOrbit ? "grid grid-cols-1 gap-2.5 sm:grid-cols-2" : multi ? "flex flex-wrap gap-2.5" : "flex flex-col gap-2.5"}>
        {q.options.map((o) => {
          const id = `${name}-${o.value}`;
          const full = multi && !!q.maxSelections && selected.size >= q.maxSelections && !selected.has(o.value);
          return (
            <div key={o.value} className={full ? "opacity-40" : undefined}>
              <input
                id={id}
                className="pill-input"
                type={multi ? "checkbox" : "radio"}
                name={name}
                value={o.value}
                checked={selected.has(o.value)}
                disabled={full}
                onChange={() => toggle(o.value)}
              />
              <label htmlFor={id}
                className={multi ? `pill inline-flex px-4 py-2.5 ${full ? "cursor-default" : ""}` : "pill flex w-full items-center gap-3 text-left"}>
                {isOrbit && (
                  <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: ORBIT_TINT[o.value as OrbitId] }} />
                )}
                <span>{o.label}</span>
              </label>
            </div>
          );
        })}
      </div>

      {multi && q.maxSelections && (
        <p className="mt-4 text-[12px] text-taupe" aria-live="polite">
          {selected.size} of {q.maxSelections} chosen
        </p>
      )}

      {q.allowNotApplicable && (
        <div className="mt-4">
          <input
            id={`${name}-na`}
            className="pill-input"
            type="radio"
            name={name}
            value={NOT_APPLICABLE}
            checked={selected.has(NOT_APPLICABLE)}
            onChange={() => onChange(NOT_APPLICABLE)}
          />
          <label htmlFor={`${name}-na`} className="pill inline-flex border-dashed text-[13px] text-taupe">
            {NOT_APPLICABLE_LABEL}
          </label>
        </div>
      )}
    </div>
  );
}
