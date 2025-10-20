import React from 'react';
import { Outlet } from 'react-router';

const RootLayout = () => {
	return (
		<div className="min-h-screen w-full relative bg-black tracking-tighter z-10">
			{/* Violet Storm Background with Top Glow */}
			<div
				className="absolute inset-0 -z-10"
				style={{
					background:
						'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(139, 92, 246, 0.25), transparent 70%), #000000',
				}}
			/>

			{/* Your Content/Components */}

			<header>
				<div className="px-2">
					<p className="text-2xl font-light opacity-20">Boardstate</p>
					<p className="text-xs font-light opacity-20">MTG Smart Table App</p>
				</div>
			</header>
			<main>
				<Outlet />
			</main>
		</div>
	);
};

export default RootLayout;
