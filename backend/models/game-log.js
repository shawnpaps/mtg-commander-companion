export const gameLogSchema = {
	type: 'object',
	required: ['gameId', 'action', 'type', 'timestamp', 'playerId'],
	properties: {
		gameId: { type: 'string' },
		action: { type: 'string' },
		type: { type: 'string' },
		card: { type: 'object' },
		timestamp: { type: 'string', format: 'date-time' },
		playerId: { type: 'string' },
	},
};
