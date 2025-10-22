import React, { useEffect, useState } from 'react';
import LandsModule from '../../components/ui/LandsModule';
import ActionsModule from '../../components/ui/ActionsModule';
import { useParams } from 'react-router';
import {
	addNewGameLogEntry,
	getPlayerGameLogs,
} from '../../utils/game-functions';
import GameVitalsModule from '../../components/ui/GameVitalsModule';
import CastingModal from '../../components/ui/CastingModal';
import BattlefieldModule from '../../components/ui/BattlefieldModule';

const PlayerGameBoard = () => {
	const params = useParams();
	const [playerGameLogs, setPlayerGameLogs] = useState<any[]>([]);

	const fetchGameLogsForPlayer = async () => {
		if (!params.gameId || !params.playerId) return;

		const playerLogs = await getPlayerGameLogs(params.gameId, params.playerId);
		console.log('Player game logs:', playerLogs);
		setPlayerGameLogs(playerLogs);
	};

	const castNewSpell = async (spell: any) => {
		try {
			const newLog = {
				card: spell,
				playerId: params.playerId,
				gameId: params.gameId,
				type: 'cast',
				action: `Player ${params.playerId} casted ${spell.name}`,
			};

			const response = await addNewGameLogEntry(newLog);

			// Add the new log to local state

			fetchGameLogsForPlayer();
		} catch (error) {
			console.error('Failed to cast spell:', error);
		}
	};

	useEffect(() => {
		fetchGameLogsForPlayer();
	}, []); // Remove playerGameLogs dependency to avoid infinite loop

	return (
		<main className="relative min-h-[40em]">
			<CastingModal
				onCastNewSpell={(logEntry: object) => castNewSpell(logEntry)}
			/>
			<div>
				<BattlefieldModule cardDataLogs={playerGameLogs} />
			</div>
			<footer className="absolute bottom-0 w-full flex justify-between items-end">
				<GameVitalsModule />
				<LandsModule />
				<ActionsModule />
			</footer>
		</main>
	);
};

export default PlayerGameBoard;
