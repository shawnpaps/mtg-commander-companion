import supabase from './client';

const checkIfGameExists = async (gameId: string) => {
	const { data, error } = await supabase
		.from('games')
		.select('*')
		.eq('game_uuid', gameId)
		.single();

	if (error) {
		console.error('Error checking if game exists:', error);
		return false;
	}

	return data;
};

const createAnonymousPlayer = async (playerName: string) => {
	const { data, error } = await supabase
		.from('active_user_game_log')
		.insert({ player_name: playerName })
		.select()
		.single();

	if (error) {
		console.error('Error creating anonymous player:', error);
		throw error;
	}

	return data;
};

const createNewGame = async (playerName: string) => {
	const player = await createAnonymousPlayer(playerName);
	if (!player) {
		throw new Error('Failed to create player');
	} else {
		const { data, error } = await supabase
			.from('games')
			.insert({ active: true, party_size: 1 })
			.select()
			.single();

		if (data) {
			const { data: playerData, error: playerError } = await supabase
				.from('active_user_game_log')
				.update({ game_uuid: data.game_uuid })
				.eq('anon_player_id', player.anon_player_id)
				.select()
				.single();

			if (playerData) {
				return { game: data, player: playerData };
			}
		}

		if (error) {
			console.error('Error creating game:', error);
			throw error;
		}
	}
};

export { createNewGame };
