export const gameSchema = {
	type: 'object',
	required: ['name', 'players', 'active'],
	properties: {
		name: { type: 'string' },
		game_type: { type: 'string' },
		players: { type: 'array', items: { type: 'object' } },
		active: { type: 'boolean', default: true },
	},
};
