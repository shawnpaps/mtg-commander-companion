import React from 'react';

interface CardData {
	_id: string;
	card: {
		imageUris: {
			small?: string;
			normal?: string;
		};
		typeLine: string;
		name: string;
	};
}

interface BattlefieldModuleProps {
	cardDataLogs: CardData[];
}

const BattlefieldModule = ({ cardDataLogs }: BattlefieldModuleProps) => {
	// Filter cards by type line
	const creatures = cardDataLogs.filter((log) =>
		log.card.typeLine.toLowerCase().includes('creature')
	);

	const artifacts = cardDataLogs.filter((log) =>
		log.card.typeLine.toLowerCase().includes('artifact')
	);

	const enchantments = cardDataLogs.filter((log) =>
		log.card.typeLine.toLowerCase().includes('enchantment')
	);

	return (
		<div className="space-y-6">
			{/* Creatures Section */}
			{creatures.length > 0 && (
				<div>
					<h3 className="text-lg font-semibold mb-3">
						Creatures ({creatures.length})
					</h3>
					<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
						{creatures.map((log) => (
							<div key={log._id} className="card bg-base-100 shadow-sm">
								<figure className="p-2">
									<img
										src={log.card.imageUris.small || log.card.imageUris.normal}
										alt={log.card.name}
										className="rounded w-full h-auto"
									/>
								</figure>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Artifacts Section */}
			{artifacts.length > 0 && (
				<div>
					<h3 className="text-lg font-semibold mb-3">
						Artifacts ({artifacts.length})
					</h3>
					<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
						{artifacts.map((log) => (
							<div key={log._id} className="card bg-base-100 shadow-sm">
								<figure className="p-2">
									<img
										src={log.card.imageUris.small || log.card.imageUris.normal}
										alt={log.card.name}
										className="rounded w-full h-auto"
									/>
								</figure>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Enchantments Section */}
			{enchantments.length > 0 && (
				<div>
					<h3 className="text-lg font-semibold mb-3">
						Enchantments ({enchantments.length})
					</h3>
					<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
						{enchantments.map((log) => (
							<div key={log._id} className="card bg-base-100 shadow-sm">
								<figure className="p-2">
									<img
										src={log.card.imageUris.small || log.card.imageUris.normal}
										alt={log.card.name}
										className="rounded w-full h-auto"
									/>
								</figure>
							</div>
						))}
					</div>
				</div>
			)}

			{/* No cards message */}
			{cardDataLogs.length === 0 && (
				<div className="text-center py-8">
					<p className="text-base-content/60">No cards on the battlefield</p>
				</div>
			)}
		</div>
	);
};

export default BattlefieldModule;
