import axios from 'axios';

const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export const searchForPlayer = async (query: string) => {
	try {
		const response = await axios.get(
			`${baseUrl}/players/search?query=${query}`
		);
		return response.data;
	} catch (error) {
		console.error('Error searching for player:', error);
		throw error;
	}
};

export const createNewPlayer = async (name: string, username: string) => {
	console.log('Creating player:', name, username);
	try {
		const response = await axios.post(`${baseUrl}/players`, {
			name: name,
			username: username,
			games_played: 0,
		});
		console.log('Player created successfully:', response.data);
		return response.data;
	} catch (error) {
		console.error('Error creating player:', error);
		throw error;
	}
};
