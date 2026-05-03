"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";
import Link from "next/link";
import FileUpload from "@/components/FileUpload";
import Loader from "@/components/Loader";
import { apiFetch } from "@/lib/apiClient";

export default function SubjectUploadPage() {
  const params = useParams();
  const router = useRouter();
  const subjectId = String(params?.subjectId || "");
  const [subjectName, setSubjectName] = useState("");
  const [loadingSubject, setLoadingSubject] = useState(true);
  const [subjectError, setSubjectError] = useState(null);
  const [generatedQcm, setGeneratedQcm] = useState(null);

  async function loadSubjectName() {
    setLoadingSubject(true);
    setSubjectError(null);
    try {
      const subjects = await apiFetch("/api/subjects");
      const subject = Array.isArray(subjects)
        ? subjects.find((item) => String(item?.id || "") === subjectId)
        : null;
      setSubjectName(subject?.name || subjectId);
    } catch (err) {
      setSubjectError(err?.message ? String(err.message) : String(err));
      setSubjectName(subjectId);
    } finally {
      setLoadingSubject(false);
    }
  }

  useEffect(() => {
    if (!subjectId) return;
    loadSubjectName();
  }, [subjectId]);

  async function handleGenerated(createdQcm, generatedQcm, effectiveSubjectId) {
    setGeneratedQcm(createdQcm || null);
    const nextSubjectId = String(
      createdQcm?.subjectId ||
        generatedQcm?.subjectId ||
        effectiveSubjectId ||
        subjectId,
    ).trim();

    if (createdQcm?.id && nextSubjectId) {
      router.push(`/subjects/${nextSubjectId}/qcm/${createdQcm.id}`);
      return;
    }
    router.push(`/subjects/${nextSubjectId || subjectId}/qcm`);
  }

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
            <span className="text-slate-500">Téléversement</span>
          </div>
          <h1 className="text-2xl font-bold">Générer un QCM</h1>
        </div>
        <Link href={`/subjects/${subjectId}/qcm`} className="btn-primary">
          Aller au QCM
        </Link>
      </div>

      <div className="rounded-xl border border-blue-100 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Analyse du support de cours</h2>
            <p className="text-sm text-slate-600 mt-1">
              Ajoutez votre fichier pour générer automatiquement un QCM clair et
              structuré.
            </p>
          </div>
          {loadingSubject ? <Loader label="Chargement du sujet…" /> : null}
        </div>

        {subjectError ? (
          <div className="mt-3 text-sm text-amber-700">{subjectError}</div>
        ) : null}

        <div className="mt-5">
          <FileUpload
            subjectId={subjectId}
            subjectName={subjectName || subjectId}
            onGenerated={handleGenerated}
          />
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <h2 className="font-semibold">Résultat attendu</h2>
        <div className="mt-2 text-sm text-slate-600 space-y-2">
          <p>
            Le fichier est analysé automatiquement afin de générer un QCM
            structuré pour vous aider à consolider vos connaissances.
          </p>

          {generatedQcm ? (
            <p className="text-primary-800 font-medium">
              Dernier QCM généré: {generatedQcm.title || "sans titre"}
            </p>
          ) : null}
        </div>
        <div className="mt-4 flex gap-2">
          <Link href={`/subjects/${subjectId}/qcm`} className="btn-outline">
            Voir les QCM générés
          </Link>
          <Link href="/subjects" className="btn-outline">
            Retour aux sujets
          </Link>
        </div>
      </div>
    </div>
  );
}
