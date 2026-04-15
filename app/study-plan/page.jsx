export default function StudyPlanPage() {
	return (
		<div className="max-w-3xl mx-auto animate-in fade-in duration-500">
			<div className="bg-white border border-slate-200 rounded-lg p-6">
				<h1 className="text-2xl font-bold text-slate-900">Plan de révision</h1>
				<p className="text-slate-600 mt-2">
					Le plan de révision se génère maintenant directement sur la page « Emploi du temps ».
				</p>
				<a
					href="/schedule"
					className="inline-flex mt-4 px-4 py-2 bg-primary-800 text-white rounded-lg font-medium hover:bg-primary-900 transition-colors shadow-sm"
				>
					Aller à l’emploi du temps
				</a>
			</div>
		</div>
	);
}

