import React from 'react';
import type { Route } from './+types/player-game-dashboard';
import { BACKEND_URL } from '~/utils/backend';
import { useParams } from 'react-router';

export function meta({}: Route.MetaArgs) {
	return [
		{ title: 'Player Game Dashboard' },
		{ name: 'description', content: 'Player Game Dashboard' },
	];
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
	const res = await fetch(`${BACKEND_URL}/api/games/${params.gameId}`);
	const gameData = await res.json();
	return gameData;
}

// HydrateFallback is rendered while the client loader is running
export function HydrateFallback() {
	return <div>Loading...</div>;
}

const PlayerGameDashboard = ({ loaderData }: Route.ComponentProps) => {
	const { game } = loaderData;
	console.log('Game data from backend', game);
	return (
		<div>
			<h1>Game</h1>
		</div>
	);
};

export default PlayerGameDashboard;
