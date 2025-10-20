import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/globals.css';
import App from './screens/Welcome.tsx';
import { BrowserRouter, Route, Routes } from 'react-router';

import Welcome from './screens/Welcome.tsx';
import GamesHome from './screens/games/GamesHome.tsx';
import CreateNewGame from './screens/games/CreateNewGame.tsx';
import RootLayout from './layouts/RootLayout.tsx';
import GameOverview from './screens/games/GameOverview.tsx';
import ActiveGameLayout from './layouts/ActiveGameLayout.tsx';
import PlayerGameBoard from './screens/games/PlayerGameBoard.tsx';
import JoinExistingGame from './screens/games/JoinExistingGame.tsx';

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<BrowserRouter>
			<Routes>
				<Route element={<RootLayout />}>
					<Route index element={<Welcome />} />
					<Route path="games">
						<Route index element={<GamesHome />} />
						<Route path="new" element={<CreateNewGame />} />
						<Route path="join" element={<JoinExistingGame />} />
					</Route>
				</Route>
				<Route element={<ActiveGameLayout />}>
					<Route path=":gameId">
						<Route index element={<GameOverview />} />
						<Route path=":playerId" element={<PlayerGameBoard />} />
					</Route>
				</Route>
			</Routes>
		</BrowserRouter>
	</StrictMode>
);
