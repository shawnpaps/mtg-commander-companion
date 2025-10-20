export const playersSchema = {
	type: 'object',
	required: ['name', 'score'],
	properties: {
		name: { type: 'string' },
		username: { type: 'string' },
		games_played: { type: 'number' },
	},
};
