'use client';

import React from 'react';
import AppLayout from '../layouts/AppLayout';
import LifeCounter from './ui/LifeCounter';

const GameBoard = ({ gameData }: { gameData: any }) => {
	console.log(gameData);
	return (
		<div className="w-full h-full p-4">
			<ul className="grid grid-cols-2 gap-6 w-full h-full">
				<li className="w-full h-full min-h-[200px]">
					<LifeCounter player={'Player 1'} />
				</li>
				<li className="w-full h-full min-h-[200px]">
					<LifeCounter player={'Player 2'} />
				</li>
				<li className="w-full h-full min-h-[200px]">
					<LifeCounter player={'Player 3'} />
				</li>
				<li className="w-full h-full min-h-[200px]">
					<LifeCounter player={'Player 4'} />
				</li>
			</ul>
		</div>
	);
};

export default GameBoard;
