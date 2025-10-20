import { gameLogSchema } from '../models/game-log.js';

export const gameLogRoutes = async function routes(fastify, options) {
	const collection = fastify.mongo.db.collection('game_logs');
	// Get all game logs
	fastify.get('/game-logs', async (request, reply) => {
		const gameLogs = await collection.find({}).toArray();
		if (gameLogs.length === 0) {
			reply.code(404).send({ message: 'No game logs found' });
			return;
		}
		return gameLogs;
	});

	// Create a new game log
	fastify.post('/game-logs', async (request, reply) => {
		const newGameLog = request.body;
		const result = await collection.insertOne(newGameLog);
		reply.code(201).send(result.ops[0]);
	});

	// Get a single game log by ID
	fastify.get('/game-logs/:id', async (request, reply) => {
		const { id } = request.params;
		const gameLog = await collection.findOne({
			_id: new fastify.mongo.ObjectId(id),
		});
		if (!gameLog) {
			reply.code(404).send({ message: 'Game log not found' });
			return;
		}
		return gameLog;
	});

	// Delete a game log by ID
	fastify.delete('/game-logs/:id', async (request, reply) => {
		const { id } = request.params;
		const result = await collection.deleteOne({
			_id: new fastify.mongo.ObjectId(id),
		});
		if (result.deletedCount === 0) {
			reply.code(404).send({ message: 'Game log not found' });
			return;
		}
		reply.code(204).send();
	});

	//Delete most recent game log
	fastify.delete('/game-logs/recent', async (request, reply) => {
		const mostRecentLog = await collection
			.find()
			.sort({ _id: -1 })
			.limit(1)
			.toArray();
		if (mostRecentLog.length === 0) {
			reply.code(404).send({ message: 'No game logs found' });
			return;
		}
		const result = await collection.deleteOne({ _id: mostRecentLog[0]._id });
		if (result.deletedCount === 0) {
			reply.code(404).send({ message: 'Game log not found' });
			return;
		}
		reply.code(204).send();
	});
};

const schema = {
	body: gameLogSchema,
};
