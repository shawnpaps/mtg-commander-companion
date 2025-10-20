export const cardRoutes = async function routes(fastify, options) {
	const collection = fastify.mongo.db.collection('cards');
	// Search for cards by name
	fastify.get('/cards/search', async (request, reply) => {
		const { name } = request.query;
		if (!name) {
			reply.code(400).send({ message: 'Name query parameter is required' });
			return;
		}
		const cards = await collection
			.find({ name: { $regex: name, $options: 'i' } })
			.toArray();
		if (cards.length === 0) {
			reply.code(404).send({ message: 'No cards found' });
			return;
		}
		return cards;
	});
};
