import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router';
import defaultBoard from '../assets/gameboards/gameboard_default.png';
import { getActiveGameInfo } from '../utils/game-functions';
import { useParams } from 'react-router';

const ActiveGameLayout = () => {
	const [gameInfo, setGameInfo] = useState<{}>({});
	const [playerInfo, setPlayerInfo] = useState<{}>();
	const params = useParams();

	const fetchGameInfo = async () => {
		let gameId = params.gameId?.toString();
		const response = await getActiveGameInfo(gameId);
		setGameInfo(response);
		if (params.playerId) {
			const activePlayer = response.players.filter(
				(player) => (player._id = params.playerId)
			);

			setPlayerInfo(activePlayer[0]);
		}
	};

	useEffect(() => {
		fetchGameInfo();
	}, []);

	console.log(playerInfo);

	return (
		<div className="min-h-screen w-full relative bg-black text-white tracking-tighter">
			{/* Background Image - Fixed and covers full screen */}
			<div className="fixed inset-0 w-full h-full z-0 ">
				<img
					className="object-cover w-full h-full opacity-75"
					src={defaultBoard}
					alt="Game board background"
				/>
			</div>

			{/* Content Layer */}
			<div className="relative z-10 min-h-screen w-full">
				<header className="flex justify-between p-5 ">
					{playerInfo && (
						<div className="card bg-white/10 backdrop-blur-xl px-4 py-2">
							<h1 className="text-xl">{playerInfo.playerName}</h1>
							<h2 className="text-xs">@{playerInfo.playerUsername}</h2>
						</div>
					)}

					<div className=" ml-auto opacity-50 font-semibold text-primary">
						<h1 className="text-2xl">{gameInfo.name}</h1>
					</div>
				</header>
				<main>
					<Outlet />
				</main>
			</div>
		</div>
	);
};

export default ActiveGameLayout;
