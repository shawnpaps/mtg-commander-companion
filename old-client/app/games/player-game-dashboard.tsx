import React, { useEffect, useState } from 'react';
import type { Route } from './+types/player-game-dashboard';
import { BACKEND_URL } from '~/utils/backend';
import { toast } from 'react-hot-toast';
import { useOutletContext, useParams } from 'react-router';
import GameDashboardHeader from './components/GameDashboardHeader';
import PlayerGrid from './components/PlayerGrid';
import BottomNavigation from '../components/ui/BottomNavigation';

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

const PlayerGameDashboard = () => {
	const { game } = useOutletContext<{ game: any }>();
	const { playerId } = useParams();
	console.log('Game', game);

	const [currentPlayerId, setCurrentPlayerId] = useState(playerId || '');

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
		<div className="min-h-screen relative ">
			<div className="relative z-10 max-w-7xl mx-auto">
				<GameDashboardHeader game={game} currentPlayerId={currentPlayerId} />
				{/* Share Success Message */}

				{/* Players Grid */}
				<PlayerGrid game={game} playerId={currentPlayerId} />
			</div>
		</div>
	);
};

export default PlayerGameDashboard;
