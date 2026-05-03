"use client";
import { useState } from "react";

export default function QCMSettings({ onGenerate, availableFiles = [] }) {
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState("medium");
  const [selectedFiles, setSelectedFiles] = useState([]);

  function toggleFile(id) {
    setSelectedFiles((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold">Paramètres</h2>
        <p className="text-sm text-slate-600 mt-1">
          Choisissez le nombre de questions, la difficulté et les fichiers à
          analyser.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Nombre de questions</label>
          <input
            type="number"
            min={1}
            max={50}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="input mt-1"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Difficulté</label>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="input mt-1"
          >
            <option value="easy">Facile</option>
            <option value="medium">Moyen</option>
            <option value="hard">Difficile</option>
          </select>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Fichiers à utiliser</div>
            <div className="text-xs text-slate-600">
              Astuce: si vous ne sélectionnez rien, tous les fichiers seront
              utilisés.
            </div>
          </div>
          <button
            type="button"
            className="btn-outline"
            onClick={() => setSelectedFiles([])}
            disabled={selectedFiles.length === 0}
          >
            Effacer
          </button>
        </div>

        {availableFiles.length === 0 ? (
          <div className="mt-2 text-sm text-slate-600">
            Aucun fichier disponible.
          </div>
        ) : (
          <div className="mt-2 flex gap-2 flex-wrap">
            {availableFiles.map((f) => {
              const active = selectedFiles.includes(f.id);
              return (
                <label
                  key={f.id}
                  className={
                    "px-3 py-1 border rounded-lg cursor-pointer select-none " +
                    (active
                      ? "bg-secondary-50 border-secondary-200"
                      : "bg-white border-slate-200 hover:bg-slate-50")
                  }
                >
                  <input
                    type="checkbox"
                    className="mr-2"
                    checked={active}
                    onChange={() => toggleFile(f.id)}
                  />
                  <span className="text-sm">{f.filename}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      <div className="pt-2">
        <button
          type="button"
          className="btn-primary w-full"
          onClick={() =>
            onGenerate?.({ count, difficulty, fileIds: selectedFiles })
          }
          disabled={availableFiles.length === 0}
        >
          Générer le QCM
        </button>
      </div>
    </div>
  );
}
