import axios from 'axios';
import cron from 'node-cron';

/**
 * Fetches all MTG cards from Scryfall's bulk data API and stores them in MongoDB
 * @param {Object} mongoClient - The MongoDB client instance
 * @returns {Promise<Object>} - Result object with sync statistics
 */
export async function syncScryfallCards(mongoClient) {
	const startTime = Date.now();
	console.log('🃏 Starting Scryfall card synchronization...');

	try {
		const collection = mongoClient.db.collection('cards');

		console.log('🔌 Database connection info:', {
			dbName: mongoClient.db.databaseName,
			collectionName: 'cards',
		});

		// Step 1: Get bulk data information
		console.log('📡 Fetching bulk data information...');
		const bulkDataResponse = await axios.get(
			'https://api.scryfall.com/bulk-data'
		);

		// Find the default cards bulk data (contains all tournament-legal cards)
		const defaultCardsData = bulkDataResponse.data.data.find(
			(item) => item.type === 'default_cards'
		);

		if (!defaultCardsData) {
			throw new Error('Default cards bulk data not found');
		}

		console.log(
			`📊 Bulk data size: ${(defaultCardsData.size / 1024 / 1024).toFixed(
				2
			)} MB`
		);
		console.log(`🔗 Download URL: ${defaultCardsData.download_uri}`);

		// Step 2: Download the bulk card data
		console.log('⬇️ Downloading bulk card data...');
		const cardsResponse = await axios.get(defaultCardsData.download_uri);
		const cards = cardsResponse.data;

		console.log(`✅ Downloaded ${cards.length} cards`);

		// Step 3: Transform and prepare cards for database storage
		console.log('🔄 Processing and transforming card data...');
		const transformedCards = cards.map((card) => ({
			scryfallId: card.id,
			name: card.name,
			manaCost: card.mana_cost || '',
			cmc: card.cmc || 0,
			typeLine: card.type_line || '',
			oracleText: card.oracle_text || '',
			colors: card.colors || [],
			colorIdentity: card.color_identity || [],
			set: card.set || '',
			setName: card.set_name || '',
			rarity: card.rarity || '',
			imageUris: card.image_uris || {},
			prices: card.prices || {},
			legalities: card.legalities || {},
			releasedAt: card.released_at ? new Date(card.released_at) : null,
			lastUpdated: new Date(),
			// Store some additional useful fields
			power: card.power || null,
			toughness: card.toughness || null,
			loyalty: card.loyalty || null,
			keywords: card.keywords || [],
			layout: card.layout || '',
			// Keep reference to original Scryfall data
			scryfallUri: card.scryfall_uri,
		}));

		// Step 4: Create index for efficient upserts
		await collection.createIndex({ scryfallId: 1 }, { unique: true });

		// Step 5: Batch upsert operations for better performance
		console.log('💾 Storing cards in database...');
		const batchSize = 1000;
		let totalInserted = 0;
		let totalModified = 0;
		let processed = 0;

		for (let i = 0; i < transformedCards.length; i += batchSize) {
			const batch = transformedCards.slice(i, i + batchSize);

			// Prepare bulk operations for upsert
			const bulkOps = batch.map((card) => ({
				updateOne: {
					filter: { scryfallId: card.scryfallId },
					update: { $set: card },
					upsert: true,
				},
			}));

			// Execute the batch
			const result = await collection.bulkWrite(bulkOps, { ordered: false });

			totalInserted += result.upsertedCount;
			totalModified += result.modifiedCount;
			processed += batch.length;

			console.log(`📝 Processed ${processed}/${transformedCards.length} cards`);
		}

		const endTime = Date.now();
		const duration = ((endTime - startTime) / 1000 / 60).toFixed(2);
		const totalCards = await collection.countDocuments();

		const result = {
			success: true,
			totalCards: transformedCards.length,
			inserted: totalInserted,
			modified: totalModified,
			totalInDatabase: totalCards,
			duration: `${duration} minutes`,
			timestamp: new Date(),
		};

		console.log('🎉 Card synchronization completed!');
		console.log(
			`📊 Stats: ${totalInserted} new, ${totalModified} updated, ${totalCards} total in DB`
		);
		console.log(`⏱️ Duration: ${duration} minutes`);

		return result;
	} catch (error) {
		console.error('❌ Error during card synchronization:', error.message);
		throw error;
	}
}

/**
 * Sets up and starts the cron job for card synchronization
 * @param {Object} mongoClient - The MongoDB client instance
 */
export function startCardSyncCronJob(mongoClient) {
	// Run every day at 3:00 AM (cron format: second minute hour day month dayOfWeek)
	const cronExpression = '0 0 3 * * *'; // Every day at 3:00 AM

	console.log('⏰ Setting up card sync cron job (daily at 3:00 AM)...');

	const job = cron.schedule(
		cronExpression,
		async () => {
			console.log('🔔 Cron job triggered: Starting scheduled card sync');

			try {
				const result = await syncScryfallCards(mongoClient);
				console.log('✅ Scheduled card sync completed successfully:', result);
			} catch (error) {
				console.error('❌ Scheduled card sync failed:', error);
			}
		},
		{
			scheduled: false, // Don't start immediately
			timezone: 'America/New_York', // Adjust timezone as needed
		}
	);

	// Start the cron job
	job.start();
	console.log('✅ Card sync cron job started successfully');

	return job;
}

/**
 * Manually trigger a card sync (useful for testing or initial setup)
 * @param {Object} mongoClient - The MongoDB client instance
 */
export async function manualCardSync(mongoClient) {
	console.log('🚀 Manual card sync triggered');
	return await syncScryfallCards(mongoClient);
}

export default {
	syncScryfallCards,
	startCardSyncCronJob,
	manualCardSync,
};
