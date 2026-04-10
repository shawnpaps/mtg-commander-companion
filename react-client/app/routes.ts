import {
	type RouteConfig,
	index,
	route,
	prefix,
	layout,
} from "@react-router/dev/routes";

export default [
	index("routes/home.tsx"),
	...prefix("games", [
		route("create-new-game", "routes/games/create-new-game.tsx"),
		layout("layouts/games/game-base-layout.tsx", [
			route(":gameId", "routes/games/game-dashboard.tsx"),
			route(":gameId/board", "routes/games/game-board.tsx"),
			route(":gameId/player/:playerId", "routes/games/player-screen.tsx"),
		]),
	]),
] satisfies RouteConfig;
