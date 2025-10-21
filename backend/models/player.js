export const playersSchema = {
	type: 'object',
	required: ['name', 'username'],
	properties: {
		name: { type: 'string' },
		username: { type: 'string' },
		games_played: { type: 'number' },
	},
};
