import axios from 'axios';

const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export const searchForCardByName = async (name: string) => {
	try {
		const response = await axios.get(`${baseUrl}/cards/search?name=${name}`);
		return response.data;
	} catch (error) {
		console.error('Card not found:', error);
		return [];
	}
};
