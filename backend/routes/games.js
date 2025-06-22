const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { GetGameAndPartyData } = require('../functions/supabase/game.js');

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

router.get('/:gameId/players/:playerId', async (req, res) => {
	try {
		const { gameId, playerId } = req.params;
		console.log(gameId, playerId);
	} catch (error) {
		console.error('Error fetching player:', error);
		res.status(500).json({ error: 'Failed to fetch player' });
	}
});

// GET game by ID
router.get('/:gameId', async (req, res) => {
	try {
		const { gameId } = req.params;
		console.log('gameId from frontend', gameId);

		const gameData = await GetGameAndPartyData(gameId);
		console.log('gameData from backend', gameData);
		res.json({ game: gameData });
	} catch (error) {
		console.error('Error fetching game:', error);
		res.status(500).json({ error: 'Failed to fetch game' });
	}
});

// POST create new game
router.post('/', async (req, res) => {
	try {
		const { playerName, playerType, email } = req.body;

		console.log(playerName, playerType, email);

		if (!playerName || !email) {
			return res
				.status(400)
				.json({ error: 'Player name and email are required' });
		}

		const { data: playerData, error: playerError } = await supabase
			.from('players')
			.insert({
				player_name: playerName,
				player_type: playerType,
				email_address: email,
			})
			.select()
			.single();

		if (playerError) throw playerError;

		const { data: gameData, error: gameError } = await supabase
			.from('games')
			.insert({
				party_size: 1,
			})
			.select()
			.single();

		if (gameError) throw gameError;

		const { data: gameLogData, error: gameLogError } = await supabase
			.from('player_game_logs')
			.insert({
				game_uuid: gameData.game_uuid,
				player_uuid: playerData.player_uuid,
				life_count: 40,
			})
			.select()
			.single();

		if (gameLogError) throw gameLogError;

		res.status(201).json({
			game: gameData,
			player: playerData,
			gameLog: gameLogData,
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
