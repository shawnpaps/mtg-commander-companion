interface GamePageProps {
	params: {
		gameID: string;
	};
}

import AppLayout from '@/app/layouts/AppLayout';
import supabase from '../../../../../backend/functions/supabase/client';
import GameBoard from '../../components/GameBoard';

export default async function GamePage({ params }: GamePageProps) {
	const fetchGameData = async () => {
		const { data, error } = await supabase
			.from('games')
			.select('*')
			.eq('game_uuid', params.gameID)
			.single();

		if (error) {
			console.error('Error fetching game data:', error);
		}

		console.log('Game data:', data);

		return data;
	};

	const gameData = await fetchGameData();

	return (
		<AppLayout>
			<GameBoard gameData={gameData} />
		</AppLayout>
	);
}
