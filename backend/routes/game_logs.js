import { gameLogSchema } from '../models/game-log.js';

export const gameLogRoutes = async function routes(fastify, options) {
	const collection = fastify.mongo.db.collection('game_logs');

	// Get all game logs
	fastify.get('/game-logs', async (request, reply) => {
		const gameLogs = await collection.find({}).toArray();
		return gameLogs; // Return empty array if no logs, not 404
	});

	// Get all game logs by gameId
	fastify.get('/game-logs/game/:gameId', async (request, reply) => {
		const { gameId } = request.params;
		console.log('Received request for gameId:', gameId);
		try {
			// Try both ObjectId and string formats
			let gameLogs = [];

			// First try as ObjectId if it's a valid ObjectId
			if (fastify.mongo.ObjectId.isValid(gameId)) {
				gameLogs = await collection
					.find({ gameId: new fastify.mongo.ObjectId(gameId) })
					.toArray();
			}

			// If no results found, try as string
			if (gameLogs.length === 0) {
				gameLogs = await collection.find({ gameId: gameId }).toArray();
			}

			console.log('Found game logs:', gameLogs.length);
			return gameLogs; // Return empty array if no logs, not 404
		} catch (error) {
			console.error('Error in game logs route:', error);
			reply.code(500).send({ message: 'Error fetching game logs' });
		}
	}); // Create a new game log
	fastify.post('/game-logs', async (request, reply) => {
		const newGameLog = request.body;
		const result = await collection.insertOne(newGameLog);

		// Fetch the inserted document to return it
		const insertedGameLog = await collection.findOne({
			_id: result.insertedId,
		});
		reply.code(201).send(insertedGameLog);
	});

	// Get a single game log by ID
	fastify.get('/game-logs/:id', async (request, reply) => {
		const { id } = request.params;
		try {
			const gameLog = await collection.findOne({
				_id: new fastify.mongo.ObjectId(id),
			});
			if (!gameLog) {
				reply.code(404).send({ message: 'Game log not found' });
				return;
			}
			return gameLog;
		} catch (error) {
			reply.code(400).send({ message: 'Invalid game log ID format' });
		}
	});

	// Delete a game log by ID
	fastify.delete('/game-logs/:id', async (request, reply) => {
		const { id } = request.params;
		try {
			const result = await collection.deleteOne({
				_id: new fastify.mongo.ObjectId(id),
			});
			if (result.deletedCount === 0) {
				reply.code(404).send({ message: 'Game log not found' });
				return;
			}
			reply.code(204).send();
		} catch (error) {
			reply.code(400).send({ message: 'Invalid game log ID format' });
		}
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
