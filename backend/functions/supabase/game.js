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

module.exports = { GetGameAndPartyData };
