import axios from 'axios';

const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export const createNewGame = async (values: any) => {
	try {
		const response = await axios.post(`${baseUrl}/games/new-game`, {
			name: values.gameName,
			game_type: values.gameType,
			active: true,
			players: [
				{
					playerName: values.playerName,
					playerId: values.playerId,
					lifeTotal: 40,
					playerUsername: values.playerUsername,
					commander: '',
				},
			],
		});
		return response.data;
	} catch (error) {
		console.error('Error creating new game:', error);
		throw error;
	}
};

export const getActiveGameInfo = async (gameId: string) => {
	try {
		const response = await axios.get(`${baseUrl}/games/${gameId}`);
		return response.data;
	} catch (error) {
		console.error('Failed to get game data', error);
		throw error;
	}
};

export const getPlayerGameLogs = async (gameId: string, playerId: string) => {
	try {
		console.log('Fetching game logs for gameId:', gameId);

		// First, let's check what game logs exist at all
		const allLogsResponse = await axios.get(`${baseUrl}/game-logs`);
		console.log('All game logs:', allLogsResponse.data);

		const response = await axios.get(`${baseUrl}/game-logs/game/${gameId}`);
		console.log('Game logs response:', response.data);

		// Handle empty array case
		if (!response.data || response.data.length === 0) {
			console.log('No game logs found for this game');
			return [];
		}

		const playerLogs = response.data.filter(
			(log: any) => log.playerId === playerId
		);
		console.log('Filtered player logs:', playerLogs);
		return playerLogs;
	} catch (error) {
		console.error('Error fetching game logs:', error);
		// Return empty array instead of throwing error for better UX
		return [];
	}
};

export const addNewGameLogEntry = async (logEntry) => {
	try {
		console.log(logEntry);
		const { action, type, card, playerId, gameId } = logEntry;
		axios.post(`${baseUrl}/game-logs`, {
			playerId: playerId,
			gameId: gameId,
			action: action,
			type: type,
			card: card,
		});
	} catch (error) {
		console.error('Error adding new log entry', error);
	}
};
