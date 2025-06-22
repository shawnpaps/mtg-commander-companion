import React, { useEffect, useState } from 'react';
import type { Route } from './+types/player-game-dashboard';
import { BACKEND_URL } from '~/utils/backend';
import { toast } from 'react-hot-toast';
import { useParams } from 'react-router';
import GameDashboardHeader from './components/GameDashboardHeader';

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
	return (
		<div className="min-h-screen  flex items-center justify-center">
			<div className="text-center">
				<div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
				<p className="text-white/80 text-lg">Loading game...</p>
			</div>
		</div>
	);
}

const PlayerGameDashboard = ({ loaderData }: Route.ComponentProps) => {
	const { game } = loaderData;
	const { playerId } = useParams();

	console.log('Game data from backend', game);
	const [currentPlayerId, setCurrentPlayerId] = useState(playerId || '');

	const [playerLifeCount, setPlayerLifeCount] = useState(
		game?.players?.[0]?.life_count
	);

	const handleLifeChange = (change: number) => {
		const newLifeCount = playerLifeCount + change;
		if (newLifeCount > playerLifeCount) {
			toast.success(
				'Sweet, sweet life.... you now have ' + newLifeCount + ' life'
			);
		} else if (newLifeCount < playerLifeCount && newLifeCount > 0) {
			toast.error(
				'Ouch! That had to hurt... you now have ' + newLifeCount + ' life'
			);
		} else if (newLifeCount === 0) {
			toast.error('Good show my dear wizard... you are now a spirit 👻');
		}
		setPlayerLifeCount(newLifeCount);
		const updatePlayerLifeCount = async () => {
			const response = await fetch(
				`${BACKEND_URL}/api/games/${game.game_uuid}/players/${currentPlayerId}/life-count`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ lifeCount: newLifeCount }),
				}
			);
			if (response.ok) {
				const data = await response.json();
				toast.success(data.message);
			} else {
				const data = await response.json();
				toast.error(data.error);
			}
		};
		setTimeout(updatePlayerLifeCount, 10000);
	};

	if (!game) {
		return (
			<div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
				<div className="text-center">
					<h1 className="text-white text-2xl mb-4">Game Not Found</h1>
					<p className="text-white/60">
						The game you're looking for doesn't exist.
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen ">
			<div className="relative z-10 max-w-7xl mx-auto">
				<GameDashboardHeader game={game} currentPlayerId={currentPlayerId} />
				{/* Share Success Message */}

				{/* Players Grid */}
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
					{game.players?.map((player: any, index: number) => (
						<div
							key={player.player_uuid}
							className={`bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 transition-all duration-300 hover:bg-white/15 ${
								player.player_uuid === currentPlayerId
									? 'ring-2 ring-blue-400'
									: ''
							}`}>
							{/* Player Header */}
							<div className="text-center mb-4">
								<h3 className="text-xl font-bold text-white mb-1">
									{player.player_name}
								</h3>
								{player.player_uuid === currentPlayerId && (
									<span className="text-xs bg-blue-500 text-white px-2 py-1 rounded-full">
										You
									</span>
								)}
							</div>

							{/* Life Total */}
							<div className="text-center mb-6">
								<div className="text-4xl font-bold text-white mb-2">
									{currentPlayerId === player.player_uuid
										? playerLifeCount <= 0
											? '👻'
											: playerLifeCount
										: player.life_count}
								</div>
								{player.player_uuid === currentPlayerId && (
									<div className="flex justify-center gap-2">
										<button
											disabled={playerLifeCount <= 0}
											onClick={() => handleLifeChange(-1)}
											className="w-10 h-10 bg-red-500/20 hover:bg-red-500/30 border border-red-400/30 rounded-lg text-red-400 font-bold transition-all duration-200 hover:scale-110">
											-
										</button>
										<button
											onClick={() => handleLifeChange(1)}
											className="w-10 h-10 bg-green-500/20 hover:bg-green-500/30 border border-green-400/30 rounded-lg text-green-400 font-bold transition-all duration-200 hover:scale-110">
											+
										</button>
									</div>
								)}
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
};

export default PlayerGameDashboard;
