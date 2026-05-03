"use client";

import { jsPDF } from "jspdf";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Loader from "@/components/Loader";
import { apiFetch } from "@/lib/apiClient";
import { getCurrentUser } from "@/lib/studentAuth";

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export default function QcmDetailPage() {
  const params = useParams();
  const router = useRouter();
  const subjectId = String(params?.subjectId || "");
  const qcmId = String(params?.qcmId || "");

  const [qcm, setQcm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [step, setStep] = useState(0);
  const [selectedByQuestionId, setSelectedByQuestionId] = useState({});
  const [timeByQuestionId, setTimeByQuestionId] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const quizStartedAtRef = useRef(null);
  const lastQuestionIdRef = useRef(null);
  const questionStartedAtRef = useRef(null);

  const [now, setNow] = useState(() => Date.now());

  const questions = Array.isArray(qcm?.questions) ? qcm.questions : [];
  const current = questions[step] || null;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch(`/api/qcms/${qcmId}`);
        if (cancelled) return;
        setQcm(data);
        setStep(0);
        setSelectedByQuestionId({});
        setTimeByQuestionId({});
        setResult(null);
        quizStartedAtRef.current = Date.now();
        lastQuestionIdRef.current = null;
        questionStartedAtRef.current = null;
      } catch (err) {
        if (cancelled) return;
        setError(err?.message ? String(err.message) : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (qcmId) load();
    return () => {
      cancelled = true;
    };
  }, [qcmId]);

  useEffect(() => {
    if (result) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [result]);

  useEffect(() => {
    if (!current?.id) return;
    if (result) return;
    const nowMs = Date.now();

    if (quizStartedAtRef.current == null) {
      quizStartedAtRef.current = nowMs;
    }

    if (lastQuestionIdRef.current && questionStartedAtRef.current) {
      const prevId = lastQuestionIdRef.current;
      const delta = Math.max(0, nowMs - questionStartedAtRef.current);
      setTimeByQuestionId((prev) => ({
        ...prev,
        [prevId]: (prev?.[prevId] || 0) + delta,
      }));
    }

    lastQuestionIdRef.current = current.id;
    questionStartedAtRef.current = nowMs;
  }, [current?.id, result]);

  const progress = useMemo(() => {
    const total = questions.length;
    if (!total) return { current: 0, total: 0, pct: 0 };
    const currentIndex = clamp(step + 1, 1, total);
    return {
      current: currentIndex,
      total,
      pct: Math.round((currentIndex / total) * 100),
    };
  }, [questions.length, step]);

  const elapsedMs = useMemo(() => {
    if (!quizStartedAtRef.current) return 0;
    return Math.max(0, now - quizStartedAtRef.current);
  }, [now]);

  function formatDuration(ms) {
    const totalSec = Math.floor((ms || 0) / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function getQuestionType(question) {
    const t = String(question?.type || "single").toLowerCase();
    return t === "multiple" ? "multiple" : "single";
  }

  function toIdSet(values) {
    const list = Array.isArray(values) ? values : [];
    return new Set(list.map((value) => String(value)));
  }

  function getCorrectOptionIds(question) {
    const options = Array.isArray(question?.options) ? question.options : [];
    return toIdSet(
      options
        .filter((option) => option?.isCorrect || option?.correct)
        .map((option) => option?.id)
        .filter(Boolean),
    );
  }

  function toggleOption(question, optionId) {
    if (!question?.id || !optionId) return;
    if (result) return;

    const qid = question.id;
    const type = getQuestionType(question);

    setSelectedByQuestionId((prev) => {
      const currentSelection = Array.isArray(prev?.[qid]) ? prev[qid] : [];

      if (type === "single") {
        return { ...prev, [qid]: [optionId] };
      }

      const exists = currentSelection.includes(optionId);
      const next = exists
        ? currentSelection.filter((x) => x !== optionId)
        : [...currentSelection, optionId];

      return { ...prev, [qid]: next };
    });
  }

  function finalizeCurrentQuestionTime() {
    if (result) return;
    const qid = lastQuestionIdRef.current;
    if (!qid || !questionStartedAtRef.current) return;
    const nowMs = Date.now();
    const delta = Math.max(0, nowMs - questionStartedAtRef.current);

    setTimeByQuestionId((prev) => ({
      ...prev,
      [qid]: (prev?.[qid] || 0) + delta,
    }));

    questionStartedAtRef.current = nowMs;
  }

  async function submit() {
    setSubmitting(true);
    try {
      finalizeCurrentQuestionTime();

      const startedAt = quizStartedAtRef.current || Date.now();
      const totalTimeMs = Math.max(0, Date.now() - startedAt);

      const answers = questions.map((q) => ({
        questionId: q.id,
        selectedOptionIds: Array.isArray(selectedByQuestionId?.[q.id])
          ? selectedByQuestionId[q.id]
          : [],
        timeSpentMs: Number(timeByQuestionId?.[q.id] || 0),
      }));

      const payload = {
        qcmId,
        answers,
        totalTimeMs,
      };

      const data = await apiFetch(`/api/qcms/${qcmId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // Prefer the richest backend payload (some backends add correction fields via /results)
      let mergedResult = data;
      try {
        const allResults = await apiFetch(`/api/qcms/${qcmId}/results`);
        if (Array.isArray(allResults) && allResults.length > 0) {
          const byId = allResults.find(
            (item) => item?.id && item.id === data?.id,
          );
          mergedResult = byId || allResults[allResults.length - 1] || data;
        }
      } catch {
        // Keep submit payload when results endpoint is unavailable.
      }

      setResult(mergedResult);
    } catch (err) {
      alert(err?.message ? String(err.message) : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  function exportPdf() {
    if (!qcm) return;

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 40;
    const marginTop = 48;
    const lineGap = 18;
    const contentWidth = pageWidth - marginX * 2;
    const fileName = `qcm_${qcm.subject || "subject"}_${qcm.id}.pdf`;
    const exportDate = new Date().toLocaleString("fr-FR");

    let y = marginTop;

    function ensureSpace(requiredHeight) {
      if (y + requiredHeight <= pageHeight - 40) return;
      doc.addPage();
      y = marginTop;
    }

    function writeTitle(text, size = 18) {
      ensureSpace(size + 20);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(size);
      doc.text(text, marginX, y);
      y += size + 14;
    }

    function writeText(text, size = 11, options = {}) {
      const lines = doc.splitTextToSize(String(text || ""), contentWidth);
      ensureSpace(lines.length * lineGap + 6);
      doc.setFont("helvetica", options.bold ? "bold" : "normal");
      doc.setFontSize(size);
      doc.text(lines, marginX, y);
      y += lines.length * lineGap + (options.tight ? 0 : 4);
    }

    function writeBadge(text, fillColor, textColor = [255, 255, 255]) {
      const badgeWidth = Math.min(
        contentWidth,
        Math.max(90, doc.getTextWidth(text) + 20),
      );
      ensureSpace(26);
      doc.setFillColor(...fillColor);
      doc.roundedRect(marginX, y - 12, badgeWidth, 18, 6, 6, "F");
      doc.setTextColor(...textColor);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(text, marginX + 10, y);
      doc.setTextColor(0, 0, 0);
      y += 18;
    }

    doc.setTextColor(0, 0, 0);
    writeTitle(qcm.title || "QCM", 20);
    writeText(`Sujet: ${qcm.subject || subjectId}`, 11, { bold: true });
    if (qcm.description) writeText(qcm.description, 11);
    writeText(`Identifiant: ${qcm.id}`, 10);
    writeText(`Exporté le: ${exportDate}`, 10);

    if (result) {
      const totalQuestions = displayScore.totalQuestions || questions.length;
      const percentage = Math.round(displayScore.percentage || 0);
      writeText(
        `Score: ${displayScore.okCount}/${totalQuestions} (${percentage}%)`,
        12,
        { bold: true },
      );
      writeText(`Temps total: ${formatDuration(elapsedMs)}`, 10);
    }

    questions.forEach((question, index) => {
      ensureSpace(90);
      writeText(`Question ${index + 1}`, 12, { bold: true });
      writeText(question.text || "", 11);

      const evaluation = questionEvaluationById.get(question.id);
      const selectedIds = evaluation?.selectedIds || new Set();
      const correctIds = evaluation?.correctIds || new Set();
      const hasResult = Boolean(result);

      (Array.isArray(question.options) ? question.options : []).forEach(
        (option) => {
          const optionId = String(option?.id ?? "");
          const selected = selectedIds.has(optionId);
          const correct = correctIds.has(optionId);
          const label = `${selected ? "[x]" : "[ ]"} ${option?.text || ""}`;

          if (hasResult && correct && selected) {
            writeBadge("Bonne réponse", [22, 163, 74]);
            writeText(label, 10, { bold: true });
          } else if (hasResult && selected && !correct) {
            writeBadge("Réponse choisie", [220, 38, 38]);
            writeText(label, 10);
          } else if (hasResult && correct && !selected) {
            writeBadge("Réponse correcte", [22, 163, 74]);
            writeText(label, 10);
          } else {
            writeText(label, 10);
          }
        },
      );

      if (result) {
        const backendAnswer = answerResultByQuestionId.get(question.id);
        const isCorrect = Boolean(backendAnswer?.isCorrect);
        const explanation = backendAnswer?.explanation || question.explanation;
        writeText(`Résultat: ${isCorrect ? "Correct" : "Incorrect"}`, 10, {
          bold: true,
        });
        if (explanation) writeText(`Explication: ${explanation}`, 10);
      }

      y += 6;
    });

    doc.save(fileName);
  }

  async function remove() {
    const user = getCurrentUser();
    if (user?.role !== "admin") {
      alert("Action réservée à l'administrateur.");
      return;
    }
    const ok = window.confirm("Supprimer ce QCM ?");
    if (!ok) return;
    try {
      await apiFetch(`/api/qcms/${qcmId}`, { method: "DELETE" });
    } catch (err) {
      alert(err?.message ? String(err.message) : "Suppression impossible");
      return;
    }
    router.push(`/subjects/${subjectId}/qcm`);
  }

  const answerResultByQuestionId = useMemo(() => {
    const map = new Map();
    const arr = Array.isArray(result?.answers) ? result.answers : [];
    for (const a of arr) {
      if (a?.questionId) map.set(a.questionId, a);
    }
    return map;
  }, [result]);

  const questionEvaluationById = useMemo(() => {
    const map = new Map();
    for (const question of questions) {
      const selectedIds = toIdSet(selectedByQuestionId?.[question.id]);
      const backendAnswer = answerResultByQuestionId.get(question.id);
      const backendCorrectIds = toIdSet(
        Array.isArray(backendAnswer?.correctOptionIds)
          ? backendAnswer.correctOptionIds
          : backendAnswer?.correctOptionId
            ? [backendAnswer.correctOptionId]
            : [],
      );

      // Get correct IDs from QCM data
      const qcmCorrectIds = getCorrectOptionIds(question);

      const correctIds =
        backendCorrectIds.size > 0 ? backendCorrectIds : qcmCorrectIds;

      const isCorrect = result
        ? Boolean(backendAnswer?.isCorrect)
        : selectedIds.size === correctIds.size &&
          [...selectedIds].every((id) => correctIds.has(id));

      map.set(question.id, {
        selectedIds,
        correctIds,
        isCorrect,
      });
    }
    return map;
  }, [questions, selectedByQuestionId, result, answerResultByQuestionId]);

  const displayScore = useMemo(() => {
    if (!result) {
      return { totalQuestions: questions.length, okCount: 0, percentage: 0 };
    }
    // Use backend score directly - do NOT recalculate
    return {
      totalQuestions: result.totalQuestions || questions.length,
      okCount: result.score || 0,
      percentage: result.percentage || 0,
    };
  }, [result, questions.length]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="text-sm text-slate-600">
            <Link
              href="/subjects"
              className="text-secondary-700 hover:underline"
            >
              Sujets
            </Link>
            <span className="mx-2">/</span>
            <Link
              href={`/subjects/${subjectId}/qcm`}
              className="text-secondary-700 hover:underline"
            >
              QCM
            </Link>
            <span className="mx-2">/</span>
            <span className="text-slate-500">Détail</span>
          </div>
          <h1 className="text-2xl font-bold">QCM</h1>
          <p className="text-sm text-slate-600">
            Sujet: <span className="font-mono text-slate-700">{subjectId}</span>
          </p>
          {qcm?.title ? (
            <div className="mt-2">
              <div className="text-lg font-semibold text-slate-900">
                {qcm.title}
              </div>
              {qcm.description ? (
                <div className="text-sm text-slate-600 mt-1">
                  {qcm.description}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            className="btn-outline"
            onClick={exportPdf}
            disabled={!qcm}
          >
            Exporter PDF
          </button>
          {getCurrentUser()?.role === "admin" ? (
            <button type="button" className="btn-outline" onClick={remove}>
              Supprimer
            </button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border bg-white p-4">
          <Loader label="Chargement…" />
        </div>
      ) : error ? (
        <div className="rounded-xl border bg-white p-4 text-sm text-red-700">
          {error}
        </div>
      ) : !qcm ? (
        <div className="rounded-xl border bg-white p-4 text-sm text-slate-600">
          QCM introuvable.
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="rounded-xl border bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">
                  Question {progress.current}/{progress.total}
                </div>
                <div className="text-xs text-slate-600">
                  Progression: {progress.pct}%
                </div>
                <div className="text-xs text-slate-600">
                  Temps: {formatDuration(elapsedMs)}
                </div>
              </div>
              {result ? (
                <div className="text-sm">
                  <div>
                    Score:{" "}
                    <span className="font-medium">{displayScore.okCount}</span>
                  </div>
                  <div className="text-xs text-slate-600">
                    {displayScore.totalQuestions} question(s) ·{" "}
                    {Math.round(displayScore.percentage || 0)}%
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-4">
              {current ? (
                <div className="space-y-3">
                  <div className="font-semibold">{current.text}</div>
                  <div className="text-xs text-slate-600">
                    Type:{" "}
                    {getQuestionType(current) === "multiple"
                      ? "choix multiple"
                      : "choix unique"}
                  </div>
                  <div className="space-y-2">
                    {(Array.isArray(current.options)
                      ? current.options
                      : []
                    ).map((opt) => {
                      const qid = current.id;
                      const evaluation = questionEvaluationById.get(qid);
                      const sel = evaluation?.selectedIds || new Set();
                      const correctIds = evaluation?.correctIds || new Set();
                      const optionId = String(opt?.id ?? "");
                      const chosen = sel.has(optionId);
                      const isCorrectOption = correctIds.has(optionId);
                      const show = Boolean(result);
                      const isQuestionCorrect = Boolean(evaluation?.isCorrect);
                      const isSelectedCorrectly =
                        show && chosen && isCorrectOption;
                      const isWrong = show && chosen && !isCorrectOption;
                      const revealCorrectChoice =
                        show &&
                        !isQuestionCorrect &&
                        isCorrectOption &&
                        !chosen;

                      const inputType =
                        getQuestionType(current) === "multiple"
                          ? "checkbox"
                          : "radio";

                      return (
                        <label
                          key={opt.id}
                          className={
                            "flex items-start gap-2 rounded-lg border px-3 py-2 cursor-pointer " +
                            (isSelectedCorrectly
                              ? "border-green-300 bg-green-100"
                              : isWrong
                                ? "border-red-300 bg-red-100"
                                : chosen
                                  ? "border-secondary-300 bg-secondary-50"
                                  : revealCorrectChoice
                                    ? "border-green-300 bg-green-100 ring-2 ring-green-300"
                                    : "border-slate-200 hover:bg-slate-50") +
                            (isSelectedCorrectly
                              ? " ring-2 ring-green-400"
                              : "") +
                            (isWrong ? " ring-2 ring-red-400" : "")
                          }
                        >
                          <input
                            type={inputType}
                            name={qid}
                            checked={chosen}
                            onChange={() => toggleOption(current, optionId)}
                            disabled={Boolean(result)}
                            className="mt-1"
                          />
                          <span className="text-sm text-slate-800">
                            {opt.text}
                            {show && isCorrectOption ? (
                              <span className="ml-2 text-xs font-medium text-green-700">
                                Bonne réponse
                              </span>
                            ) : null}
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  {result
                    ? (() => {
                        // Use backend verdict directly - do NOT recalculate locally
                        const backendAnswer = answerResultByQuestionId.get(
                          current.id,
                        );
                        const isCorrect = Boolean(backendAnswer?.isCorrect);
                        const explanation =
                          backendAnswer?.explanation || current.explanation;

                        return (
                          <div className="text-sm text-slate-700 space-y-1">
                            <div>
                              Résultat:{" "}
                              {isCorrect ? (
                                <span className="font-medium text-green-700">
                                  Correct
                                </span>
                              ) : (
                                <span className="font-medium text-red-700">
                                  Incorrect
                                </span>
                              )}
                            </div>
                            {explanation ? (
                              <div className="text-xs text-slate-600">
                                Explication: {explanation}
                              </div>
                            ) : null}
                          </div>
                        );
                      })()
                    : null}
                </div>
              ) : (
                <div className="text-sm text-slate-600">Aucune question.</div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                className="btn-outline"
                onClick={() =>
                  setStep((s) =>
                    clamp(s - 1, 0, Math.max(0, questions.length - 1)),
                  )
                }
                disabled={step === 0}
              >
                Précédent
              </button>
              <div className="flex gap-2">
                {!result ? (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={submit}
                    disabled={submitting || questions.length === 0}
                  >
                    {submitting ? "Soumission…" : "Soumettre"}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => {
                      setResult(null);
                      setSelectedByQuestionId({});
                      setTimeByQuestionId({});
                      setStep(0);
                      quizStartedAtRef.current = Date.now();
                      lastQuestionIdRef.current = null;
                      questionStartedAtRef.current = null;
                    }}
                  >
                    Recommencer
                  </button>
                )}
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() =>
                    setStep((s) =>
                      clamp(s + 1, 0, Math.max(0, questions.length - 1)),
                    )
                  }
                  disabled={step >= questions.length - 1}
                >
                  Suivant
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-4">
            <h2 className="font-semibold">Corrections</h2>
            <p className="text-sm text-slate-600 mt-1">
              Les réponses correctes apparaissent après soumission.
            </p>

            {!result ? (
              <div className="mt-3 text-sm text-slate-600">
                Soumettez vos réponses pour voir le score et les corrections.
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {questions.map((q, idx) => {
                  // Use backend verdict directly for each question
                  const backendAnswer = answerResultByQuestionId.get(q.id);
                  const isCorrect = Boolean(backendAnswer?.isCorrect);

                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setStep(idx)}
                      className={
                        "w-full text-left rounded-lg border px-3 py-2 text-sm " +
                        (isCorrect
                          ? "border-green-200 bg-green-50"
                          : "border-red-200 bg-red-50")
                      }
                    >
                      <div className="font-medium">
                        {idx + 1}. {q.text}
                      </div>
                      <div className="text-xs mt-1">
                        {isCorrect ? "Correct" : "Incorrect"}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
