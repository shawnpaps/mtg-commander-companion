const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// GET all games
router.get('/', async (req, res) => {
	try {
		const { data, error } = await supabase
			.from('games')
			.select('*')
			.order('created_at', { ascending: false });

		if (error) throw error;

		res.json({ games: data });
	} catch (error) {
		console.error('Error fetching games:', error);
		res.status(500).json({ error: 'Failed to fetch games' });
	}
});

// GET game by ID
router.get('/:gameId', async (req, res) => {
	try {
		const { gameId } = req.params;

		const { data, error } = await supabase
			.from('games')
			.select('*')
			.eq('id', gameId)
			.single();

		if (error) throw error;

		if (!data) {
			return res.status(404).json({ error: 'Game not found' });
		}

		res.json({ game: data });
	} catch (error) {
		console.error('Error fetching game:', error);
		res.status(500).json({ error: 'Failed to fetch game' });
	}
});

// POST create new game
router.post('/', async (req, res) => {
	try {
		const { playerName, startingLife = 40 } = req.body;

		if (!playerName) {
			return res.status(400).json({ error: 'Player name is required' });
		}

		const gameData = {
			id: `game-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
			status: 'active',
			starting_life: startingLife,
			created_by: playerName,
			created_at: new Date().toISOString(),
		};

		const { data, error } = await supabase
			.from('games')
			.insert([gameData])
			.select()
			.single();

		if (error) throw error;

		res.status(201).json({
			game: data,
			message: 'Game created successfully',
		});
	} catch (error) {
		console.error('Error creating game:', error);
		res.status(500).json({ error: 'Failed to create game' });
	}
});

// PUT update game
router.put('/:gameId', async (req, res) => {
	try {
		const { gameId } = req.params;
		const updateData = req.body;

		const { data, error } = await supabase
			.from('games')
			.update(updateData)
			.eq('id', gameId)
			.select()
			.single();

		if (error) throw error;

		if (!data) {
			return res.status(404).json({ error: 'Game not found' });
		}

		res.json({
			game: data,
			message: 'Game updated successfully',
		});
	} catch (error) {
		console.error('Error updating game:', error);
		res.status(500).json({ error: 'Failed to update game' });
	}
});

// DELETE game
router.delete('/:gameId', async (req, res) => {
	try {
		const { gameId } = req.params;

		const { error } = await supabase.from('games').delete().eq('id', gameId);

		if (error) throw error;

		res.json({ message: 'Game deleted successfully' });
	} catch (error) {
		console.error('Error deleting game:', error);
		res.status(500).json({ error: 'Failed to delete game' });
	}
});

module.exports = router;
