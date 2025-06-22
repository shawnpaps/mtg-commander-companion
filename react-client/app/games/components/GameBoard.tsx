import React, { useState } from 'react';
import {
	FaShieldAlt,
	FaCog,
	FaMountain,
	FaCrown,
	FaHeart,
	FaPlus,
	FaBox,
	FaTimes,
	FaChevronUp,
} from 'react-icons/fa';
import CardModule from './gameboard/CardModule';
import GameBoardModule from './gameboard/GameBoardModule';
import LandModule from './gameboard/LandModule';
import CommandZoneModule from './gameboard/CommandZoneModule';

const GameBoard = ({ player }: { player: any }) => {
	console.log('Player', player);
	return (
		<div className="grid grid-cols-3 gap-4 p-4">
			{/* Battlefield - Green for creatures and combat */}
			<GameBoardModule
				title="Battlefield"
				description="Creatures, Planeswalkers, and Combat"
				icon={<FaShieldAlt className="w-6 h-6 text-emerald-100" />}
				classNames="col-span-3 bg-gradient-to-br from-emerald-600 via-green-500 to-emerald-700 rounded-2xl p-6 shadow-lg border border-emerald-400/30"
				textColor="text-emerald-50"
				descriptionColor="text-emerald-100/80"
			/>

			{/* Artifacts/Enchantments - Blue for artifacts, Gold for enchantments */}
			<GameBoardModule
				title="Artifacts & Enchantments"
				description="Permanent spells and equipment"
				icon={<FaCog className="w-6 h-6 text-blue-100" />}
				classNames="col-span-3 bg-gradient-to-br from-blue-600 via-indigo-500 to-purple-600 rounded-2xl p-6 shadow-lg border border-blue-400/30"
				textColor="text-blue-50"
				descriptionColor="text-blue-100/80"
			/>

			{/* Lands - Brown for lands */}
			<LandModule
				description="Mana Sources"
				icon={<FaMountain className="w-6 h-6 text-amber-100" />}
				classNames="col-span-3 bg-gradient-to-br from-amber-700 via-yellow-600 to-orange-600 rounded-2xl p-6 shadow-lg border border-amber-400/30"
				textColor="text-amber-50"
				descriptionColor="text-amber-100/80"
			/>

			{/* Commander Info - Purple for legendary creatures */}
			<CommandZoneModule
				title="Commander Info"
				description="Commander damage and abilities"
				icon={<FaCrown className="w-6 h-6 text-purple-100" />}
				classNames="col-span-3 bg-gradient-to-br from-purple-700 via-violet-600 to-purple-800 rounded-2xl p-6 shadow-lg border border-purple-400/30"
				textColor="text-purple-50"
				descriptionColor="text-purple-100/80"
			/>

			{/* Life Total - Red for life points */}
			<div className="col-span-1 bg-gradient-to-br from-red-600 via-pink-500 to-red-700 rounded-2xl p-4 shadow-lg border border-red-400/30">
				<div className="flex items-center gap-2 mb-2">
					<FaHeart className="w-5 h-5 text-red-100" />
					<h4 className="text-lg font-bold text-red-50">Life</h4>
				</div>
				<div className="text-2xl font-bold text-red-100">
					{player?.life_count || 40}
				</div>
			</div>

			{/* Counters - Blue for counters */}
			<div className="col-span-1 bg-gradient-to-br from-cyan-600 via-blue-500 to-cyan-700 rounded-2xl p-4 shadow-lg border border-cyan-400/30">
				<div className="flex items-center gap-2 mb-2">
					<FaPlus className="w-5 h-5 text-cyan-100" />
					<h4 className="text-lg font-bold text-cyan-50">Counters</h4>
				</div>
				<div className="text-2xl font-bold text-cyan-100">+1/+1</div>
			</div>

			{/* Graveyard - Black for graveyard */}
			<div className="col-span-1 bg-gradient-to-br from-gray-800 via-gray-700 to-gray-900 rounded-2xl p-4 shadow-lg border border-gray-600/30">
				<div className="flex items-center gap-2 mb-2">
					<FaBox className="w-5 h-5 text-gray-300" />
					<h4 className="text-lg font-bold text-gray-200">Graveyard</h4>
				</div>
				<div className="text-2xl font-bold text-gray-300">0</div>
			</div>
		</div>
	);
};

export default GameBoard;
