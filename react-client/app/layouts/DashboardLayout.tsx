import React from 'react';
import type { Route } from './+types/DashboardLayout';
import { Outlet, useParams } from 'react-router';
import { BACKEND_URL } from '~/utils/backend';
import BottomNavigation from '~/components/ui/BottomNavigation';

export function meta({}: Route.MetaArgs) {
	return [
		{ title: 'Dashboard' },
		{ name: 'description', content: 'Dashboard' },
	];
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
	const res = await fetch(`${BACKEND_URL}/api/games/${params.gameId}`);
	const gameData = await res.json();
	console.log('GameData', gameData);
	return gameData;
}

// HydrateFallback is rendered while the client loader is running
export function HydrateFallback() {
	return (
		<div className="min-h-screen  flex items-center justify-center">
			<div className="text-center">
				<div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
				<p className="text-white/80 text-lg">Loading game...</p>
			</div>
		</div>
	);
}
const DashboardLayout = ({ loaderData }: Route.ComponentProps) => {
	const { game } = loaderData;
	console.log('Game', game);
	const { playerId } = useParams();

	const links = game.players.map((player: any) => {
		return {
			id: player.player_uuid,
			name: player.player_name,
			path: `/games/${game.game_uuid}/boards/${player.player_uuid}`,
		};
	});
	console.log('Game', game);
	return (
		<main className="pt-16 p-4 container mx-auto flex flex-col items-center justify-center max-w-screen-md">
			<Outlet context={{ game }} />

			<BottomNavigation links={links} game={game} playerId={playerId} />
		</main>
	);
};

export default DashboardLayout;
