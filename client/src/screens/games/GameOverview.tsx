import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { getActiveGameInfo } from '../../utils/game-functions';

const GameOverview = () => {
	const params = useParams();

	const [gameInfo, setGameInfo] = useState({});

	const fetchGameInfo = async () => {
		let gameId = params.gameId?.toString();

		const response = await getActiveGameInfo(gameId);

		setGameInfo(response);
	};

	useEffect(() => {
		fetchGameInfo();
	}, []);

	return (
		<div className="min-h-[40em]">
			<section className="grid grid-cols-2 p-5">
				{gameInfo.players?.map((player) => (
					<div
						key={player.playerId}
						className="card card-border tracking-tighter bg-base-100 col-span-1">
						<div className="card-body text-center">
							<div>
								<h1>{player.playerName}'s Life Total</h1>
								<p className="text-9xl font-bold">{player.lifeTotal}</p>
							</div>
							<div>
								{player.commander === '' ? (
									<button>Set Commander</button>
								) : (
									<div>
										<p>{player.commander}</p>
									</div>
								)}
							</div>
							<div className="card-actions justify-end"></div>
						</div>
					</div>
				))}
			</section>
		</div>
	);
};

export default GameOverview;
