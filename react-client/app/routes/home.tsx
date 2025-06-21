import type { Route } from './+types/home';
import { Welcome } from '../welcome/welcome';

export function meta({}: Route.MetaArgs) {
	return [
		{ title: 'New React Router App' },
		{ name: 'description', content: 'Welcome to React Router!' },
	];
}

export default function Home() {
	return (
		<main className="pt-16 p-4 container mx-auto flex flex-col items-center justify-center">
			<h1 className="text-4xl font-bold">MTG EDH Companion</h1>
			<h2 className="text-2xl font-bold">
				The Ultimate in-person Game State Manager for Magic: The Gathering
			</h2>
			<div className="flex flex-col items-center justify-center gap-4 min-h-[40rem]">
				<button className="btn btn-primary">Start a new game</button>
				<span className="text-lg font-bold">or</span>
				<button className="btn btn-primary">Join a game</button>
			</div>
		</main>
	);
}
