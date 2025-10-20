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
