import { gameSchema } from '../models/game.js';

export const gameRoutes = async function routes(fastify, options) {
	const collection = fastify.mongo.db.collection('games');

	// Get all games
	fastify.get('/games', async (request, reply) => {
		const games = await collection.find({}).toArray();
		if (games.length === 0) {
			reply.code(404).send({ message: 'No games found' });
			return;
		}
		return games;
	});

	// Get Single Game By Id
	fastify.get('/games/:id', async (request, reply) => {
		const { id } = request.params;
		const game = await collection.findOne({
			_id: new fastify.mongo.ObjectId(id),
		});
		if (!game) {
			reply.code(404).send({ message: 'Game not found' });
			return;
		}
		return game;
	});

	// Create a new game
	fastify.post('/games/new-game', { schema }, async (request, reply) => {
		const newGame = request.body;

		console.log('gameData:', newGame);
		const result = await collection.insertOne(newGame);

		// Fetch the inserted document to return it
		const insertedGame = await collection.findOne({ _id: result.insertedId });
		reply.code(201).send(insertedGame);
	});
	// Update a game's active status
	fastify.put('/games/:id', { schema }, async (request, reply) => {
		const { id } = request.params;
		const updatedData = request.body;
		const result = await collection.findOneAndUpdate(
			{ _id: new fastify.mongo.ObjectId(id) },
			{ $set: updatedData },
			{ returnDocument: 'after' }
		);
		if (!result.value) {
			reply.code(404).send({ message: 'Game not found' });
			return;
		}
		reply.send(result.value);
	});
};

const schema = {
	body: gameSchema,
};
