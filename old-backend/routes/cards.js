const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

router.get('/:cardId', async (req, res) => {
	try {
		const { cardId } = req.params;
		const { data: card } = await supabase
			.from('cards')
			.select('*')
			.eq('id', cardId)
			.single();

		if (!card) {
			return res.status(404).json({ error: 'Card not found' });
		}

		res.json(card);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

module.exports = router;
