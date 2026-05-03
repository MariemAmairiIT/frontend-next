const subjects = new Map();
let nextSubjectId = 1;
let nextFileId = 1;
let nextQcmId = 1;

function genId(prefix, n) {
  return `${prefix}_${n}`;
}

export function listSubjects() {
  return Array.from(subjects.values());
}

export function createSubject(name) {
  const id = genId("sub", nextSubjectId++);
  const obj = { id, name: String(name || "Untitled"), files: [], qcms: [] };
  subjects.set(id, obj);
  return obj;
}

export function getSubject(id) {
  return subjects.get(String(id)) || null;
}

function ensureSubject(subjectId) {
  const id = String(subjectId || "");
  if (!id) return null;
  const existing = subjects.get(id);
  if (existing) return existing;

  const obj = { id, name: id, files: [], qcms: [] };
  subjects.set(id, obj);
  return obj;
}

export function addFile(subjectId, { filename, buffer, mimeType }) {
  const subj = ensureSubject(subjectId);
  if (!subj) throw new Error("Subject not found");
  const id = genId("file", nextFileId++);
  const file = {
    id,
    filename,
    mimeType,
    size: buffer?.byteLength || 0,
    createdAt: Date.now(),
    buffer,
  };
  subj.files.push(file);
  return file;
}

export function listFiles(subjectId) {
  const subj = getSubject(subjectId);
  if (!subj) return [];
  return subj.files.map((f) => ({
    id: f.id,
    filename: f.filename,
    mimeType: f.mimeType,
    size: f.size,
    createdAt: f.createdAt,
  }));
}

// Simple QCM generator that produces placeholder questions based on filenames
export function generateQcm(
  subjectId,
  { fileIds = [], count = 5, difficulty = "medium" } = {},
) {
  const subj = getSubject(subjectId);
  if (!subj) throw new Error("Subject not found");

  const questions = [];
  for (let i = 0; i < count; i++) {
    const fileRef = subj.files[i % Math.max(1, subj.files.length)];
    const q = {
      id: genId("q", i + 1),
      question: `Question ${i + 1} (${difficulty}) about ${fileRef ? fileRef.filename : subj.name}`,
      choices: ["Réponse A", "Réponse B", "Réponse C", "Réponse D"],
      answer: Math.floor(Math.random() * 4),
    };
    questions.push(q);
  }

  const qcm = {
    id: genId("qcm", nextQcmId++),
    subjectId,
    createdAt: Date.now(),
    questions,
    meta: { count, difficulty },
  };
  subj.qcms.push(qcm);
  return qcm;
}

export function listQcms(subjectId) {
  const subj = getSubject(subjectId);
  if (!subj) return [];
  return subj.qcms;
}

export function getQcm(subjectId, qcmId) {
  const subj = getSubject(subjectId);
  if (!subj) return null;
  return subj.qcms.find((q) => q.id === qcmId) || null;
}

export function listAllQcms({ subjectId } = {}) {
  const all = [];
  for (const subj of subjects.values()) {
    if (subjectId && subj.id !== String(subjectId)) continue;
    for (const qcm of subj.qcms) {
      all.push({
        ...qcm,
        subjectName: subj.name,
        questionCount: Array.isArray(qcm.questions) ? qcm.questions.length : 0,
      });
    }
  }

  all.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return all;
}

export function findQcmById(qcmId) {
  const id = String(qcmId);
  for (const subj of subjects.values()) {
    const qcm = subj.qcms.find((q) => q.id === id);
    if (qcm) return { qcm, subject: subj };
  }
  return null;
}

export function updateQcm(qcmId, patch) {
  const found = findQcmById(qcmId);
  if (!found) throw new Error("QCM not found");

  const { qcm } = found;
  if (patch && typeof patch === "object") {
    if (typeof patch.title === "string") qcm.title = patch.title;
    if (patch.meta && typeof patch.meta === "object") {
      qcm.meta = { ...(qcm.meta || {}), ...patch.meta };
    }
    if (Array.isArray(patch.questions)) qcm.questions = patch.questions;
    qcm.updatedAt = Date.now();
  }

  return qcm;
}

export function deleteQcm(qcmId) {
  const id = String(qcmId);
  for (const subj of subjects.values()) {
    const idx = subj.qcms.findIndex((q) => q.id === id);
    if (idx !== -1) {
      const [removed] = subj.qcms.splice(idx, 1);
      return removed;
    }
  }
  throw new Error("QCM not found");
}

export function submitQcm(qcmId, answersByQuestionId) {
  const found = findQcmById(qcmId);
  if (!found) throw new Error("QCM not found");
  const { qcm } = found;

  const questions = Array.isArray(qcm.questions) ? qcm.questions : [];
  const answers =
    answersByQuestionId && typeof answersByQuestionId === "object"
      ? answersByQuestionId
      : {};

  let ok = 0;
  const corrections = questions.map((question) => {
    const chosen = answers[question.id];
    const isCorrect = typeof chosen === "number" && chosen === question.answer;
    if (isCorrect) ok++;
    return {
      questionId: question.id,
      chosen: typeof chosen === "number" ? chosen : null,
      correct: question.answer,
      isCorrect,
    };
  });

  return {
    qcmId: qcm.id,
    total: questions.length,
    ok,
    score: questions.length ? ok / questions.length : 0,
    corrections,
  };
}

// Pre-create a demo subject for convenience
createSubject("Mathématiques");

export default {
  listSubjects,
  createSubject,
  getSubject,
  addFile,
  listFiles,
  generateQcm,
  listQcms,
  getQcm,
  listAllQcms,
  findQcmById,
  updateQcm,
  deleteQcm,
  submitQcm,
};
