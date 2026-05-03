import SignUpForm from "@/components/auth/SignUpForm";

export const metadata = {
  title: "S'inscrire - Study Planner",
  description: "Créer un nouveau compte",
};

export default function SignUpPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center bg-cover bg-center py-12 px-4 sm:px-6 lg:px-8 relative"
      style={{
        backgroundImage: "url(/images/background.png)",
        backgroundAttachment: "fixed",
      }}
    >
      <div className="absolute inset-0 bg-black opacity-30"></div>

      <div className="max-w-md w-full space-y-8 relative z-10">
        <div>
          <h2 className="mt-6 text-center text-4xl font-extrabold text-[#b31919] ">
            Créer un compte
          </h2>
          <p className="mt-2 text-center text-xl font-bold text-[#1A3A52]">
            Rejoignez Study Planner et commencez à organiser votre apprentissage
          </p>
        </div>

        <div className="bg-white bg-opacity-95 py-8 px-6 shadow-2xl rounded-xl sm:px-10 backdrop-blur-sm border border-gray-100">
          <SignUpForm />
        </div>
      </div>
    </div>
  );
}
