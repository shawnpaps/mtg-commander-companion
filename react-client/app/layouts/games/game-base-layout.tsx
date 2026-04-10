import { Outlet } from "react-router";
import { NavLink } from "react-router";

export default function GameBaseLayout() {
	let gameId = "KRLv0zbH";
	return (
		<main className="h-screen w-screen">
			<section>
				<Outlet />
			</section>
			<nav className="fixed bottom-0 w-full flex bg-gray-200 p-4 justify-center">
				<div className="flex gap-4">
					<NavLink to={`games/${gameId}/board`}>Board</NavLink>
				</div>
				<div className="flex gap-4">
					<NavLink to="/">Player 1</NavLink>
				</div>
				<div className="flex gap-4">
					<NavLink to="/">Player 2</NavLink>
				</div>
				<div className="flex gap-4">
					<NavLink to="/">Player 3</NavLink>
				</div>
				<div className="flex gap-4">
					<NavLink to="/">Player 4</NavLink>
				</div>
			</nav>
		</main>
	);
}
