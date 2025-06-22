import { useOutletContext, useParams } from 'react-router';
import GameBoard from './components/GameBoard';

const PlayerBoard = () => {
	const { playerId } = useParams();
	const { game } = useOutletContext<{ game: any }>();

	const currentPlayer = game.players.find(
		(player: any) => player.player_uuid === playerId
	);

	console.log('Player Name', currentPlayer);
	return (
		<div>
			<GameBoard player={currentPlayer} />
		</div>
	);
};

export default PlayerBoard;
