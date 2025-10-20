require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const cron = require('node-cron');

class ScryfallSyncService {
	constructor() {
		const supabaseUrl =
			process.env.SUPABASE_URL || 'https://lhhnpfxbpoecsuvmdxux.supabase.co';
		const supabaseServiceKey = process.env.SUPABASE_ANON_KEY;

		if (!supabaseServiceKey) {
			throw new Error('SUPABASE_ANON_KEY environment variable is required');
		}

		this.supabase = createClient(supabaseUrl, supabaseServiceKey);
		this.batchSize = 1000; // Process cards in batches
		this.isRunning = false;
	}

	async startSync() {
		if (this.isRunning) {
			console.log('Sync already running, skipping...');
			return { status: 'already_running' };
		}

		this.isRunning = true;
		const startTime = Date.now();

		try {
			console.log('🚀 Starting Scryfall card sync...');

			// Step 1: Get bulk data download URL
			const bulkDataUrl = await this.getBulkDataUrl();
			console.log('📥 Downloading bulk data from:', bulkDataUrl);

			// Step 2: Download and process the data
			const cards = await this.downloadBulkData(bulkDataUrl);
			console.log(`📊 Downloaded ${cards.length} cards`);

			// Step 3: Process cards in batches
			const result = await this.processBatches(cards);

			const duration = Math.round((Date.now() - startTime) / 1000);
			console.log(`✅ Sync completed in ${duration}s:`, result);

			return {
				status: 'success',
				duration: duration,
				...result,
			};
		} catch (error) {
			console.error('❌ Sync failed:', error.message);
			return {
				status: 'error',
				error: error.message,
			};
		} finally {
			this.isRunning = false;
		}
	}

	async getBulkDataUrl() {
		try {
			const response = await axios.get('https://api.scryfall.com/bulk-data');
			const bulkData = response.data.data.find(
				(item) => item.type === 'default_cards'
			);

			if (!bulkData) {
				throw new Error('Could not find default_cards bulk data');
			}

			return bulkData.download_uri;
		} catch (error) {
			throw new Error(`Failed to get bulk data URL: ${error.message}`);
		}
	}

	async downloadBulkData(url) {
		try {
			console.log('⏳ Downloading bulk data (this may take a few minutes)...');
			const response = await axios.get(url, {
				timeout: 600000, // 10 minute timeout
				maxContentLength: Infinity,
				maxBodyLength: Infinity,
			});

			if (!Array.isArray(response.data)) {
				throw new Error('Invalid bulk data format');
			}

			return response.data;
		} catch (error) {
			throw new Error(`Failed to download bulk data: ${error.message}`);
		}
	}

	async processBatches(cards) {
		let processed = 0;
		let inserted = 0;
		let updated = 0;
		let errors = 0;

		console.log(
			`📦 Processing ${cards.length} cards in batches of ${this.batchSize}...`
		);

		for (let i = 0; i < cards.length; i += this.batchSize) {
			const batch = cards.slice(i, i + this.batchSize);

			try {
				const batchResult = await this.processBatch(batch);
				processed += batch.length;

				// Supabase doesn't return detailed upsert counts, so we estimate
				inserted += batchResult.newCards || 0;
				updated += batchResult.updatedCards || 0;

				// Log progress every 10 batches
				if ((i / this.batchSize + 1) % 10 === 0) {
					const progress = Math.round((processed / cards.length) * 100);
					console.log(
						`📈 Progress: ${progress}% (${processed}/${cards.length} cards)`
					);
				}
			} catch (error) {
				console.error(
					`❌ Batch error (cards ${i}-${i + batch.length}):`,
					error.message
				);
				errors += batch.length;
			}
		}

		return {
			total: cards.length,
			processed: processed,
			estimated_inserted: inserted,
			estimated_updated: updated,
			errors: errors,
		};
	}

	async processBatch(cards) {
		const transformedCards = cards
			.map((card) => this.transformCard(card))
			.filter(Boolean);

		if (transformedCards.length === 0) {
			return { newCards: 0, updatedCards: 0 };
		}

		const { error } = await this.supabase
			.from('cards')
			.upsert(transformedCards, {
				onConflict: 'id',
				ignoreDuplicates: false,
			});

		if (error) {
			throw new Error(`Database error: ${error.message}`);
		}

		// Since we can't get exact counts from upsert, estimate based on data
		return {
			newCards: Math.round(transformedCards.length * 0.1), // Estimate 10% new
			updatedCards: Math.round(transformedCards.length * 0.9), // Estimate 90% updated
		};
	}

	transformCard(card) {
		try {
			return {
				id: card.id,
				name: card.name,
				mana_cost: card.mana_cost || null,
				cmc: card.cmc || 0,
				type_line: card.type_line || null,
				oracle_text: card.oracle_text || null,
				power: card.power || null,
				toughness: card.toughness || null,
				colors: card.colors || [],
				set_code: card.set,
				set_name: card.set_name,
				rarity: card.rarity,
				prices: card.prices || {},
				image_uris: card.image_uris || {},
				scryfall_uri: card.scryfall_uri,
				last_updated: new Date().toISOString(),
			};
		} catch (error) {
			console.warn(`⚠️  Skipping invalid card:`, error.message);
			return null;
		}
	}

	// Get sync status
	getStatus() {
		return {
			isRunning: this.isRunning,
			lastRun: this.lastRun || null,
		};
	}

	// Schedule daily sync at 2 AM
	scheduleDailySync() {
		cron.schedule('0 2 * * *', async () => {
			console.log('🕐 Running scheduled Scryfall sync...');
			const result = await this.startSync();
			this.lastRun = {
				timestamp: new Date().toISOString(),
				result: result,
			};
		});

		console.log('📅 Scheduled daily sync at 2:00 AM');
	}
}

module.exports = ScryfallSyncService;
