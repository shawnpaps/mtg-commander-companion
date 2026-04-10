import GameBaseLayout from "../../layouts/games/game-base-layout.tsx";

export default function GameDashboard() {
	return (
		<div className="h-screen w-screen">
			<section className="grid grid-cols-4 p-5 gap-4 h-full w-full">
				<PlayerCard />
				<PlayerCard />
				<PlayerCard />
				<PlayerCard />
			</section>
		</div>
	);
}

function PlayerCard() {
	return (
		<article className="col-span-2 relative border-2 flex flex-col items-center justify-center">
			<div>
				<h1 className="text-7xl font-bold">40</h1>
			</div>{" "}
			<h2 className="absolute bottom-0 text-2xl font-semibold">Player Name</h2>
		</article>
	);
}
