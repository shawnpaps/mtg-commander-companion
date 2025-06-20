import React, { useState } from 'react';

const LifeCounter = ({ player }: { player: any }) => {
	const [life, setLife] = useState(40);

	const handleLifeChange = (change: number) => {
		setLife(life + change);
	};

	return (
		<div className="flex flex-col items-center justify-center rounded-xl p-6 min-h-[200px] w-full text-white font-bold text-center bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 shadow-lg hover:shadow-xl transition-all duration-300">
			<h2 className="text-xl font-bold mb-4 text-white/90">{player}</h2>
			<div className="flex flex-row items-center justify-center gap-6">
				<button
					onClick={() => handleLifeChange(-1)}
					className="w-12 h-12 rounded-full bg-white/20 hover:bg-white/30 text-2xl font-bold flex items-center justify-center transition-all duration-200 hover:scale-110">
					-
				</button>

				<p className="text-4xl font-bold text-white min-w-[80px]">{life}</p>

				<button
					onClick={() => handleLifeChange(1)}
					className="w-12 h-12 rounded-full bg-white/20 hover:bg-white/30 text-2xl font-bold flex items-center justify-center transition-all duration-200 hover:scale-110">
					+
				</button>
			</div>
		</div>
	);
};

export default LifeCounter;
