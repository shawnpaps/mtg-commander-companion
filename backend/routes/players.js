import { playersSchema } from '../models/player.js';

export const playerRoutes = async function routes(fastify, options) {
	const collection = fastify.mongo.db.collection('players');

	// Get all players
	fastify.get('/players', async (request, reply) => {
		const players = await collection.find({}).toArray();
		if (players.length === 0) {
			reply.code(404).send({ message: 'No players found' });
			return;
		}
		return players;
	});

	//Search for Player
	fastify.get('/players/search', async (request, reply) => {
		const { query } = request.query;
		if (!query) {
			reply.code(400).send({ message: 'query parameter is required' });
			return;
		}
		const players = await collection
			.find({ name: { $regex: query, $options: 'i' } })
			.toArray();
		if (players.length === 0) {
			reply.code(404).send({ message: 'No players found' });
			return;
		}
		return players;
	});

	// Get Single Player By Id
	fastify.get('/players/:id', async (request, reply) => {
		const { id } = request.params;
		const player = await collection.findOne({
			_id: new fastify.mongo.ObjectId(id),
		});
		if (!player) {
			reply.code(404).send({ message: 'Player not found' });
			return;
		}
		return player;
	});

	// Create a new player
	fastify.post('/players', { schema }, async (request, reply) => {
		const newPlayer = request.body;
		console.log(newPlayer);
		const result = await collection.insertOne(newPlayer);

		// Fetch the inserted document to return it
		const insertedPlayer = await collection.findOne({ _id: result.insertedId });
		reply.code(201).send(insertedPlayer);
	});

	// Update a player
	fastify.put('/players/:id', { schema }, async (request, reply) => {
		const { id } = request.params;
		const updatedData = request.body;
		const result = await collection.findOneAndUpdate(
			{ _id: new fastify.mongo.ObjectId(id) },
			{ $set: updatedData },
			{ returnDocument: 'after' }
		);
		if (!result.value) {
			reply.code(404).send({ message: 'Player not found' });
			return;
		}
		reply.send(result.value);
	});

	// Delete a player
	fastify.delete('/players/:id', async (request, reply) => {
		const { id } = request.params;
		const result = await collection.deleteOne({
			_id: new fastify.mongo.ObjectId(id),
		});
		if (result.deletedCount === 0) {
			reply.code(404).send({ message: 'Player not found' });
			return;
		}
		reply.code(204).send();
	});
};

const schema = {
	body: playersSchema,
};
// Create a new player
