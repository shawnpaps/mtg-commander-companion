import {
	type RouteConfig,
	index,
	layout,
	prefix,
	route,
} from '@react-router/dev/routes';

export default [
	layout('layouts/WelcomeLayout.tsx', [
		index('home/home.tsx'),
		route('new-game', 'home/new-game.tsx'),
		route('join-game', 'home/join-game.tsx'),
	]),
	...prefix('games', [
		layout('layouts/DashboardLayout.tsx', [
			route(':gameId/players/:playerId', 'games/player-game-dashboard.tsx'),
		]),
	]),
] satisfies RouteConfig;
