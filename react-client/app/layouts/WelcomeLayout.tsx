import type { Route } from './+types/WelcomeLayout';
import { Outlet } from 'react-router';

export function meta({}: Route.MetaArgs) {
	return [
		{ title: 'New React Router App' },
		{ name: 'description', content: 'Welcome to React Router!' },
	];
}

export default function WelcomeLayout() {
	return (
		<main className="pt-16 p-4 container mx-auto flex flex-col items-center justify-center">
			<div className="w-full h-[20rem] flex-col flex items-center justify-center gap-4">
				<h1 className="text-4xl font-bold">MTG EDH Companion</h1>
				<h2 className="text-2xl font-bold">
					The Ultimate in-person Game State Manager for Magic: The Gathering
				</h2>
			</div>
			<div className="w-full flex-col flex items-center justify-center">
				<Outlet />
			</div>
		</main>
	);
}
