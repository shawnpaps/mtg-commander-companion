import React from 'react';
import { Link } from 'react-router';
import { FaBeer, FaWizardsOfTheCoast } from 'react-icons/fa';
import { FaHatWizard, FaUser } from 'react-icons/fa6';

const BottomNavigation = ({
	links,
	game,
	playerId,
}: {
	links: { id: string; name: string; path: string }[];
	game: any;
	playerId: any;
}) => {
	return (
		<footer className="fixed bottom-0 left-0 right-0 bg-white/10 backdrop-blur-md rounded-2xl p-6 mb-6 border border-white/20 flex justify-between items-center gap-4 max-w-sm mx-auto">
			<div>
				<Link
					className="mr-auto"
					to={`/games/${game.game_uuid}/players/${playerId}`}>
					<button className="text-white/80 hover:scale-105 hover:text-white transition-all flex flex-col items-center justify-center duration-200">
						<FaHatWizard className="text-2xl" />
						<span className="text-xs">Dashboard</span>
					</button>
				</Link>
			</div>
			<div className="flex w-full">
				{links.map((link: any) => (
					<Link
						key={link.id}
						to={link.path}
						className="text-white/80 hover:scale-105 hover:text-white transition-all flex flex-col items-center justify-center duration-200">
						<FaUser className="text-2xl" />
						<span className="text-xs">{link.name}</span>
					</Link>
				))}
			</div>
		</footer>
	);
};

export default BottomNavigation;
