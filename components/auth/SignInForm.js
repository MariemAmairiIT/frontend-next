"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signinUser } from "@/lib/api/auth";
import { clearAuthSession, saveAuthSession } from "@/lib/studentAuth";

export default function SignInForm({ message = "", roleFromQuery = "" }) {
  const router = useRouter();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [role, setRole] = useState(
    roleFromQuery === "admin" ? "admin" : "student",
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!formData.email || !formData.password) {
      setError("L'e-mail et le mot de passe sont requis");
      return;
    }

    setLoading(true);

    try {
      const data = await signinUser(role, {
        email: formData.email,
        password: formData.password,
      });

      // Persist Basic auth for protected student workflows.
      saveAuthSession({
        email: formData.email,
        password: formData.password,
        user: { ...(data || {}), role },
      });

      // Redirect to dashboard
      router.push(role === "student" ? "/dashboard" : "/");
    } catch (err) {
      clearAuthSession();
      setError(err.message || "Une erreur s'est produite lors de la connexion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {message && (
        <div className="p-4 bg-[#1A3A52]/20 border border-[#1A3A52] text-[#1A3A52] rounded-lg">
          {message}
        </div>
      )}

      {error && (
        <div className="p-4 bg-[#8B1538]/20 border border-[#8B1538] text-[#8B1538] rounded-lg">
          {error}
        </div>
      )}

      <div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setRole("student")}
            className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
              role === "student"
                ? "bg-[#1A3A52] text-white border-[#1A3A52]"
                : "bg-white text-gray-700 border-gray-300 hover:border-[#1A3A52]"
            }`}
          >
            Etudiant
          </button>
          <button
            type="button"
            onClick={() => setRole("admin")}
            className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
              role === "admin"
                ? "bg-[#1A3A52] text-white border-[#1A3A52]"
                : "bg-white text-gray-700 border-gray-300 hover:border-[#1A3A52]"
            }`}
          >
            Administrateur
          </button>
        </div>
      </div>

      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="etudiant@studyplanner.com"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg transition duration-200 ease-in-out focus:outline-none focus:border-[#8B1538] focus:ring-1 focus:ring-[#8B1538] focus:shadow-md text-black placeholder:text-gray-500"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-gray-700"
        >
          Mot de passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={formData.password}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg transition duration-200 ease-in-out focus:outline-none focus:border-[#8B1538] focus:ring-1 focus:ring-[#8B1538] focus:shadow-md text-black placeholder:text-gray-500"
          placeholder="••••••••"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[#b31919] text-white py-2 rounded-lg hover:bg-[#A01C47] disabled:bg-gray-400 transition font-medium"
      >
        {loading ? "Connexion..." : "Se connecter"}
      </button>

      <p className="text-center text-sm text-gray-600">
        Vous n&apos;avez pas de compte?{" "}
        <Link
          href="/signup"
          className="text-[#8B1538] hover:text-[#A01C47] font-medium"
        >
          S&apos;inscrire
        </Link>
      </p>
    </form>
  );
}
