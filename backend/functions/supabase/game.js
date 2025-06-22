const supabase = require('../../config/supabase');

const GetGameAndPartyData = async (gameId) => {
	try {
		// Get the game data
		const { data: gameData, error: gameError } = await supabase
			.from('games')
			.select('*')
			.eq('game_uuid', gameId)
			.single();

		if (gameError) {
			console.error('Error fetching game:', gameError);
			throw gameError;
		}

		if (!gameData) {
			throw new Error('Game not found');
		}

		console.log('Game Data:', gameData);

		// Get the most recent life count for each player in this game
		const { data: playerLogs, error: playerError } = await supabase
			.from('player_game_logs')
			.select(
				`
				player_uuid,
				life_count,
				created_at,
				players (
					player_name,
					player_uuid
				)
			`
			)
			.eq('game_uuid', gameData.game_uuid)
			.order('created_at', { ascending: false });

		if (playerError) {
			console.error('Error fetching player logs:', playerError);
			throw playerError;
		}

		console.log('Raw Player Logs:', playerLogs);

		// Get the most recent log entry for each unique player
		const latestPlayerLogs = [];
		const seenPlayers = new Set();

		for (const log of playerLogs) {
			console.log('Processing log:', log);
			if (!seenPlayers.has(log.player_uuid)) {
				seenPlayers.add(log.player_uuid);
				latestPlayerLogs.push(log);
			}
		}

		console.log('Latest Player Logs:', latestPlayerLogs);

		// Combine game data with player information
		const gameWithParty = {
			...gameData,
			players: latestPlayerLogs.map((log) => {
				console.log('Mapping log:', log);
				return {
					...log.players,
					life_count: log.life_count,
					last_updated: log.created_at,
				};
			}),
		};

		console.log('Final gameWithParty:', gameWithParty);

		return gameWithParty;
	} catch (error) {
		console.error('Error in GetGameAndPartyData:', error);
		throw error;
	}
};

const GetGameData = async (gameId) => {
	const { data: gameData, error: gameError } = await supabase
		.from('games')
		.select('*')
		.eq('game_uuid', gameId)
		.single();

	if (gameError) {
		console.error('Error fetching game:', gameError);
		throw gameError;
	}

	return gameData;
};

const AddPlayerToGame = async (gameId, playerName, email, playerType) => {
	const currentGameData = await GetGameData(gameId);
	const { data: playerData, error: playerError } = await supabase
		.from('players')
		.insert({
			player_name: playerName,
			email_address: email,
			player_type: playerType,
		})
		.select()
		.single();

	if (playerError) {
		console.error('Error adding player to game:', playerError);
		throw playerError;
	}

	const { data: gameData, error: gameError } = await supabase
		.from('games')
		.update({
			party_size: currentGameData.party_size + 1,
		})
		.eq('game_uuid', gameId)
		.select()
		.single();

	if (gameError) {
		console.error('Error updating game:', gameError);
		throw gameError;
	}

	console.log('PlayerData after game party update:', playerData);

	const { data: playerLogData, error: playerLogError } = await supabase
		.from('player_game_logs')
		.insert({
			player_uuid: playerData.player_uuid,
			game_uuid: gameData.game_uuid,
			life_count: 40,
		})
		.select();

	if (playerLogError) {
		console.error('Error adding player log:', playerLogError);
		throw playerLogError;
	}

	return { playerData, gameData, playerLogData };
};

module.exports = { GetGameAndPartyData, AddPlayerToGame };
