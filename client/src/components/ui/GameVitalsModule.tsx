import React, { useState } from 'react';

const GameVitalsModule = () => {
	const [isOpen, setIsOpen] = useState(false);
	return (
		<div className="relative w-1/3">
			{isOpen ? (
				<div className="bg-black/50 backdrop-blur-2xl h-[70dvh] z-20 p-2 rounded-r-3xl ">
					<section className="flex justify-between items-center">
						<h1>Game Vitals</h1>
						<button onClick={() => setIsOpen(false)} className="btn btn-ghost">
							Close
						</button>
					</section>
				</div>
			) : (
				<button
					onClick={() => setIsOpen(true)}
					className="btn-accent btn-lg btn">
					Vitals
				</button>
			)}
		</div>
	);
};

export default GameVitalsModule;
