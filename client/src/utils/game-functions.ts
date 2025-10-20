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
				},
			],
		});
		return response.data;
	} catch (error) {
		console.error('Error creating new game:', error);
		throw error;
	}
};
