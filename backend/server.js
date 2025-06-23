const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const ScryfallSyncService = require('./config/scryfall-sync');

require('dotenv').config();

const syncService = new ScryfallSyncService();

syncService.scheduleDailySync();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(
	cors({
		origin: process.env.FRONTEND_URL || 'http://localhost:3000',
		credentials: true,
	})
);
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
	res.json({
		status: 'OK',
		timestamp: new Date().toISOString(),
		message: 'MTG Commander Companion Backend is running',
	});
});

// Game routes
app.use('/api/games', require('./routes/games'));
app.use('/api/scryfall', require('./routes/scryfall'));
app.use('/api/cards', require('./routes/cards'));
// Error handling middleware
app.use((err, req, res, next) => {
	console.error(err.stack);
	res.status(500).json({
		error: 'Something went wrong!',
		message:
			process.env.NODE_ENV === 'development'
				? err.message
				: 'Internal server error',
	});
});

// 404 handler
app.use('*', (req, res) => {
	res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
	console.log(`🚀 Server running on port ${PORT}`);
	console.log(`📊 Health check: http://localhost:${PORT}/health`);
	console.log(`🎮 Game API: http://localhost:${PORT}/api/games`);
});
