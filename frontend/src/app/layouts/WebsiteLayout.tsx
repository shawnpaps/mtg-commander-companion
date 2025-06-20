import React from 'react';

const WebsiteLayout = ({ children }: { children: React.ReactNode }) => {
	return (
		<>
			<header>
				<h1>MTG Commander Companion</h1>
			</header>
			<main className="flex-1 flex flex-col items-center justify-center min-h-[40rem] w-full">
				{children}
			</main>
		</>
	);
};

export default WebsiteLayout;
