"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signupUser } from "@/lib/api/auth";

export default function SignUpForm() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
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

    if (
      !formData.name ||
      !formData.email ||
      !formData.password ||
      !formData.confirmPassword
    ) {
      setError("Tous les champs sont requis");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }

    if (formData.password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }

    setLoading(true);

    try {
      await signupUser("student", {
        name: formData.name,
        email: formData.email,
        password: formData.password,
      });

      router.push(
        "/signin?message=Compte créé avec succès. Veuillez vous connecter.",
      );
    } catch (err) {
      setError(
        err.message || "Une erreur s'est produite lors de l'inscription",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-4 bg-[#8B1538]/20 border border-[#8B1538] text-[#8B1538] rounded-lg">
          {error}
        </div>
      )}

      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium text-gray-700"
        >
          Nom complet
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          value={formData.name}
          onChange={handleChange}
          className=" mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg transition duration-200 ease-in-out focus:outline-none focus:border-[#8B1538] focus:ring-1 focus:ring-[#8B1538] focus:shadow-md placeholder:text-gray-500 text-black"
          placeholder="Etudiant"
        />
      </div>

      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-gray-700"
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
          className=" mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg transition duration-200 ease-in-out focus:outline-none focus:border-[#8B1538] focus:ring-1 focus:ring-[#8B1538] focus:shadow-md placeholder:text-gray-500 text-black"
          placeholder="etudiant@studyplanner.com"
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
          autoComplete="new-password"
          value={formData.password}
          onChange={handleChange}
          className=" mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg transition duration-200 ease-in-out focus:outline-none focus:border-[#8B1538] focus:ring-1 focus:ring-[#8B1538] focus:shadow-md placeholder:text-gray-500 text-black"
          placeholder="••••••••"
        />
      </div>

      <div>
        <label
          htmlFor="confirmPassword"
          className="block text-sm font-medium text-gray-700"
        >
          Confirmer le mot de passe
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={formData.confirmPassword}
          onChange={handleChange}
          className=" mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg transition duration-200 ease-in-out focus:outline-none focus:border-[#8B1538] focus:ring-1 focus:ring-[#8B1538] focus:shadow-md placeholder:text-gray-500 text-black"
          placeholder="••••••••"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[#b31919] text-white py-2 rounded-lg hover:bg-[#A01C47] disabled:bg-gray-400 transition font-medium"
      >
        {loading ? "Création du compte..." : "S'inscrire"}
      </button>

      <p className="text-center text-sm text-gray-600">
        Vous avez déjà un compte?{" "}
        <Link
          href="/signin"
          className="text-[#8B1538] hover:text-[#A01C47] font-medium"
        >
          Connectez-vous
        </Link>
      </p>
    </form>
  );
}
