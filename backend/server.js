import Fastify from 'fastify';
import cors from '@fastify/cors';
import dbConnector from './db/mongo-connector.js';
import { playerRoutes } from './routes/players.js';
import { cardRoutes } from './routes/cards.js';
import { startCardSyncCronJob, manualCardSync } from './services/cron-jobs.js';
import dotenv from 'dotenv';
import { gameRoutes } from './routes/games.js';
import { gameLogRoutes } from './routes/game_logs.js';

// Load environment variables from .env file
dotenv.config();

const fastify = Fastify({ logger: true });

// Register CORS plugin
await fastify.register(cors, {
	origin: [
		'http://localhost:3000', // React dev server
		'http://localhost:5173', // Vite dev server
		'http://localhost:4173', // Vite preview
		process.env.CLIENT_URL || 'http://localhost:5173',
	],
	credentials: true,
	methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
});

// Register the database connector plugin
fastify.register(dbConnector);

// Register player routes
fastify.register(playerRoutes);

// Register card routes
fastify.register(cardRoutes);

fastify.register(gameRoutes);

fastify.register(gameLogRoutes);

// Add a manual card sync route for testing/initial setup
fastify.get('/admin/sync-cards', async (request, reply) => {
	try {
		const result = await manualCardSync(fastify.mongo);
		reply.send(result);
	} catch (error) {
		reply.code(500).send({ error: error.message });
	}
});

// Test route to check cards collection
fastify.get('/admin/cards-count', async (request, reply) => {
	try {
		const collection = fastify.mongo.db.collection('cards');
		const count = await collection.countDocuments();
		const sampleCard = await collection.findOne();

		reply.send({
			database: fastify.mongo.db.databaseName,
			cardsCount: count,
			sampleCard: sampleCard,
		});
	} catch (error) {
		reply.code(500).send({ error: error.message });
	}
});

// Start the server
fastify.listen({ port: process.env.PORT || 5000 }, async (err, address) => {
	if (err) {
		fastify.log.error(err);
		process.exit(1);
	}
	fastify.log.info(`Server listening at ${address}`);

	// Wait a moment for the database connection to be ready
	await new Promise((resolve) => setTimeout(resolve, 1000));

	// Start the card sync cron job
	try {
		startCardSyncCronJob(fastify.mongo);
		fastify.log.info('Card sync cron job initialized');
	} catch (error) {
		fastify.log.error('Failed to start card sync cron job:', error);
	}
});
