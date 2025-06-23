const express = require('express');
const router = express.Router();
const ScryfallSyncService = require('../config/scryfall-sync');

const syncService = new ScryfallSyncService();

router.post('/sync', async (req, res) => {
	try {
		const result = await syncService.startSync();
		res.json(result);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

// Get sync status
router.get('/sync/status', (req, res) => {
	res.json(syncService.getStatus());
});

// Get card stats
router.get('/stats', async (req, res) => {
	try {
		const { data: cardCount } = await syncService.supabase
			.from('cards')
			.select('id', { count: 'exact', head: true });

		const { data: recentCards } = await syncService.supabase
			.from('cards')
			.select('last_updated')
			.order('last_updated', { ascending: false })
			.limit(1);

		res.json({
			totalCards: cardCount?.length || 0,
			lastUpdated: recentCards?.[0]?.last_updated || null,
		});
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

module.exports = router;
