"use client";

import { useMemo, useState } from "react";

export default function QCMList({ qcm }) {
  const questions = useMemo(() => {
    return Array.isArray(qcm?.questions) ? qcm.questions : [];
  }, [qcm]);

  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const score = useMemo(() => {
    if (!submitted) return null;
    let ok = 0;
    for (const q of questions) {
      const chosen = answers[q.id];
      if (typeof chosen === "number" && chosen === q.answer) ok++;
    }
    return { ok, total: questions.length };
  }, [answers, questions, submitted]);

  if (!qcm) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-slate-600">
          {submitted && score ? (
            <span>
              Score:{" "}
              <span className="font-medium text-slate-800">
                {score.ok}/{score.total}
              </span>
            </span>
          ) : (
            <span>Répondez puis cliquez sur “Corriger”.</span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-outline"
            onClick={() => {
              setAnswers({});
              setSubmitted(false);
            }}
          >
            Réinitialiser
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => setSubmitted(true)}
          >
            Corriger
          </button>
        </div>
      </div>

      {questions.map((q, idx) => {
        const chosen = answers[q.id];
        const isCorrect =
          submitted && typeof chosen === "number" && chosen === q.answer;
        const isWrong =
          submitted && typeof chosen === "number" && chosen !== q.answer;

        return (
          <div
            key={q.id}
            className={
              "rounded-xl border bg-white p-4 " +
              (isCorrect
                ? "border-green-200"
                : isWrong
                  ? "border-red-200"
                  : "border-slate-200")
            }
          >
            <div className="font-semibold">
              {idx + 1}. {q.question}
            </div>

            <div className="mt-3 space-y-2">
              {q.choices.map((c, i) => {
                const checked = chosen === i;
                const highlightCorrect = submitted && q.answer === i;
                return (
                  <label
                    key={i}
                    className={
                      "flex items-start gap-2 rounded-lg border px-3 py-2 cursor-pointer " +
                      (checked
                        ? "border-secondary-300 bg-secondary-50"
                        : "border-slate-200 hover:bg-slate-50") +
                      (highlightCorrect ? " ring-1 ring-green-300" : "")
                    }
                  >
                    <input
                      type="radio"
                      name={q.id}
                      checked={checked}
                      onChange={() => setAnswers((a) => ({ ...a, [q.id]: i }))}
                      className="mt-1"
                    />
                    <span className="text-sm text-slate-800">{c}</span>
                  </label>
                );
              })}
            </div>

            {submitted ? (
              <div className="mt-3 text-sm">
                <span className="text-slate-600">Réponse correcte: </span>
                <span className="font-medium text-slate-800">
                  {q.choices[q.answer]}
                </span>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
