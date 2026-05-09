const STORAGE_KEY = "studyplanner:archived-subjects";
const USER_KEY = "sp_user_v1";

function getOwnerScope() {
  if (typeof window === "undefined") return "anon";

  try {
    const raw = window.sessionStorage.getItem(USER_KEY);
    if (!raw) return "anon";

    const parsed = JSON.parse(raw);
    const email = String(parsed?.email || "")
      .trim()
      .toLowerCase();
    if (!email) return "anon";

    return email.replace(/[^a-z0-9@._-]/g, "_");
  } catch {
    return "anon";
  }
}

function scopedKey() {
  return `${STORAGE_KEY}:${getOwnerScope()}`;
}

function readRawList() {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(scopedKey());
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRawList(list) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(scopedKey(), JSON.stringify(list));
  } catch {
    // ignore quota/storage errors
  }
}

function normalizeSubject(subject) {
  if (!subject || typeof subject !== "object") return null;

  const id = String(subject.id || subject.slug || "").trim();
  if (!id) return null;

  return {
    ...subject,
    id,
    name: String(subject.name || id),
    slug: String(subject.slug || id),
    archived: Boolean(subject.archived),
  };
}

export function loadArchivedSubjects() {
  return readRawList().map(normalizeSubject).filter(Boolean);
}

export function saveArchivedSubjects(subjects) {
  const normalized = Array.isArray(subjects)
    ? subjects.map(normalizeSubject).filter(Boolean)
    : [];
  writeRawList(normalized);
}

export function upsertArchivedSubject(subject) {
  const normalized = normalizeSubject(subject);
  if (!normalized) return;

  const current = readRawList().map(normalizeSubject).filter(Boolean);
  const next = current.filter(
    (item) => String(item.id) !== String(normalized.id),
  );

  if (normalized.archived) {
    next.unshift(normalized);
  }

  writeRawList(next);
}

export function removeArchivedSubject(subjectId) {
  const normalizedId = String(subjectId || "").trim();
  if (!normalizedId) return;

  const next = readRawList()
    .map(normalizeSubject)
    .filter(Boolean)
    .filter((item) => String(item.id) !== normalizedId);

  writeRawList(next);
}
