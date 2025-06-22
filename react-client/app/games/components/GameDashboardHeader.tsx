import React, { useState } from 'react';
import { toast } from 'react-hot-toast';

const GameDashboardHeader = ({
	game,
}: {
	game: any;
	currentPlayerId: string;
}) => {
	const handleShareGame = async () => {
		const gameUrl = window.location.href;

		try {
			await navigator.clipboard.writeText(gameUrl);
			toast.success('Game link copied to clipboard');
		} catch (error) {
			console.error('Failed to copy to clipboard:', error);
			// Fallback for older browsers
			const textArea = document.createElement('textarea');
			textArea.value = gameUrl;
			document.body.appendChild(textArea);
			textArea.select();
			document.execCommand('copy');
			document.body.removeChild(textArea);
			toast.error('Failed to copy to clipboard');
		}
	};
	return (
		<div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 mb-6 border border-white/20">
			<div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
				<div>
					<h1 className="text-3xl font-bold text-white mb-2">Commander Game</h1>
					<div className="flex flex-wrap gap-4 text-white/80">
						<span className="flex items-center gap-2">
							<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
								<path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
							Game ID: {game.game_uuid}
						</span>
						<span className="flex items-center gap-2">
							<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
								<path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
							</svg>
							Party Size: {game.players?.length || 0}
						</span>
					</div>
				</div>
				<div className="flex gap-2">
					<button
						onClick={handleShareGame}
						className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-4 py-2 rounded-lg font-semibold transition-all duration-200 hover:scale-105 flex items-center gap-2">
						<svg
							className="w-5 h-5"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
							/>
						</svg>
						Share Game
					</button>
				</div>
			</div>
		</div>
	);
};

export default GameDashboardHeader;
