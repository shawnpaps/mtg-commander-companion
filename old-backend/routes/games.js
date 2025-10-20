const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const {
	GetGameAndPartyData,
	AddPlayerToGame,
} = require('../functions/supabase/game.js');

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
				life_count: 40,
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

		const { data: playerLogData, error: playerLogError } = await supabase
			.from('player_game_logs')
			.insert({
				game_uuid: gameData.game_uuid,
				player_uuid: playerData.player_uuid,
				action: 'new player joined game',
			})
			.select()
			.single();

		if (playerLogError) throw playerLogError;

		res.status(201).json({
			game: gameData,
			player: playerData,
			playerLog: playerLogData,
			message: 'Game created successfully',
		});
	} catch (error) {
		console.error('Error creating game:', error);
		res.status(500).json({ error: 'Failed to create game' });
	}
});

// POST update life count
router.post('/:gameId/players/:playerId/life-count', async (req, res) => {
	try {
		const { gameId, playerId } = req.params;
		const { lifeCount } = req.body;
		console.log('Life count', lifeCount);

		const { data, error } = await supabase
			.from('players')
			.update({ life_count: lifeCount })
			.eq('player_uuid', playerId)
			.select();

		if (error) throw error;

		res.json({ data, message: 'Life count updated successfully' });
	} catch (error) {
		console.error('Error updating life count:', error);
		res.status(500).json({ error: 'Failed to update life count' });
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

// POST add player to game

router.post('/:gameId/players/add-player', async (req, res) => {
	try {
		const { gameId } = req.params;
		const { playerName, email, playerType } = req.body;

		console.log(gameId, playerName, email, playerType);

		if (!playerName || !email || !playerType) {
			return res
				.status(400)
				.json({ error: 'Player name, email, and player type are required' });
		}

		const { playerData, gameData, playerLogData } = await AddPlayerToGame(
			gameId,
			playerName,
			email,
			playerType
		);

		res.status(201).json({
			player: playerData,
			game: gameData,
			playerLog: playerLogData,
			message: `Time to sling some spells, ${playerName}!`,
		});
	} catch (error) {
		console.error('Error adding player to game:', error);
		res.status(500).json({ error: 'Failed to add player to game' });
	}
});

// PUT Player Leaves Game
router.put('/:gameId/players/:playerId/leave-game', async (req, res) => {
	try {
		const { gameId, playerId } = req.params;

		console.log('Game ID', gameId);
		console.log('Player ID', playerId);

		const { data: playerData, error: playerError } = await supabase
			.from('players')
			.select('*')
			.eq('player_uuid', playerId)
			.single();

		const { data: gameData, error: gameError } = await supabase
			.from('games')
			.select('*')
			.eq('game_uuid', gameId)
			.single();

		if (gameError) throw gameError;

		const partySize = gameData.party_size;

		const { data: updatedGameData, error: updatedGameError } = await supabase
			.from('games')
			.update({ party_size: partySize - 1 })
			.eq('game_uuid', gameData.game_uuid)
			.select()
			.single();

		if (updatedGameError) throw updatedGameError;

		const { data: playerLogData, error: playerLogError } = await supabase
			.from('player_game_logs')
			.insert({
				game_uuid: gameData.game_uuid,
				player_uuid: playerId,
				action: 'player left game',
			})
			.select()
			.single();

		if (playerLogError) throw playerLogError;

		res.json({
			game: updatedGameData,
			playerLog: playerLogData,
			message: `${playerData.player_name} left the game lobby`,
		});
	} catch (error) {
		console.error('Error removing player from game:', error);
		res.status(500).json({ error: 'Failed to remove player from game' });
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
