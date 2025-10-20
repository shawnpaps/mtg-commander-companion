import fastifyPlugin from 'fastify-plugin';
import fastifyMongo from '@fastify/mongodb';

async function dbConnector(fastify, options) {
	fastify.register(fastifyMongo, {
		url: process.env.MONGO_DB_URI || 'mongodb://localhost:27017/boardstate-db',
	});
}

export default fastifyPlugin(dbConnector);
