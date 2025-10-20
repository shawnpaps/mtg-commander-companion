import React from 'react';
import { Outlet } from 'react-router';

const ActiveGameLayout = () => {
	return (
		<div className="min-h-screen w-full relative bg-black text-white z-10">
			{/* Violet Storm Background with Top Glow */}
			<div
				className="absolute inset-0 z-0"
				style={{
					background:
						'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(139, 92, 246, 0.25), transparent 70%), #000000',
				}}
			/>

			{/* Your Content/Components */}

			<header></header>
			<main>
				<Outlet />
			</main>
		</div>
	);
};

export default ActiveGameLayout;
