import React, { useState } from 'react';
import CardModule from './CardModule';
import { FaShieldAlt } from 'react-icons/fa';

const GameBoardModule = ({
	title,
	description,
	icon,
	classNames,
	textColor = 'text-emerald-50',
	descriptionColor = 'text-emerald-100/80',
}: {
	title: string;
	description: string;
	icon: React.ReactNode;
	classNames: string;
	textColor?: string;
	descriptionColor?: string;
}) => {
	const [expanded, setExpanded] = useState(false);
	return (
		<>
			<div className={classNames}>
				<button onClick={() => setExpanded(true)} className="w-full text-left">
					<div className="flex items-center gap-3 mb-3">
						{icon}
						<h3 className={`text-xl font-bold ${textColor}`}>{title}</h3>
					</div>
					<p className={`text-sm ${descriptionColor}`}>{description}</p>
				</button>
				{expanded && (
					<div className="mt-4 min-h-[40rem] w-full bg-white/10 backdrop-blur-md rounded-2xl p-2 border border-white/20 flex flex-wrap gap-4">
						<button
							className="btn btn-lg mx-auto mb-4"
							onClick={() => setExpanded(false)}>
							Collapse
						</button>
						<CardModule />
						<CardModule />
						<CardModule />
						<CardModule />
					</div>
				)}
			</div>
		</>
	);
};

export default GameBoardModule;
