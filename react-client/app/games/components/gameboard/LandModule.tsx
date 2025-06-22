import React, { useState } from 'react';
import { FaMountain, FaSkull, FaSun, FaTree, FaWater } from 'react-icons/fa';
import { FaDroplet } from 'react-icons/fa6';
import CardModule from './CardModule';

const LandModule = ({
	description,
	icon,
	classNames,
	textColor,
	descriptionColor,
}: {
	description: string;
	icon: React.ReactNode;
	classNames: string;
	textColor: string;
	descriptionColor: string;
}) => {
	const [expanded, setExpanded] = useState(false);
	return (
		<>
			<div className={classNames}>
				<button onClick={() => setExpanded(true)} className="w-full text-left">
					<div className="flex items-center gap-3 mb-3">
						{icon}
						<h3 className={`text-xl font-bold ${textColor}`}>Lands</h3>
					</div>
					<p className={`text-sm ${descriptionColor}`}>{description}</p>
				</button>
				{expanded && (
					<div className="mt-4  w-full bg-white/10 backdrop-blur-md rounded-2xl  border border-white/20  gap-4 flex flex-col items-center">
						<button
							className="btn btn-lg mx-auto mb-4"
							onClick={() => setExpanded(false)}>
							Collapse
						</button>

						{/* Basic Lands */}
						<div className="w-full p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20">
							<h2 className="text-2xl font-bold underline underline-offset-2 decoration-white/50">
								Basic Lands
							</h2>
							<ul className="flex flex-wrap gap-4 justify-between w-full mt-2 text-2xl">
								<li className="flex flex-col items-center gap-2">
									<FaSun />
									<span>4</span>
								</li>
								<li className="flex flex-col items-center gap-2">
									<FaDroplet />
									<span>4</span>
								</li>
								<li className="flex flex-col items-center gap-2">
									<FaMountain />
									<span>4</span>
								</li>
								<li className="flex flex-col items-center gap-2">
									<FaTree />
									<span>4</span>
								</li>
								<li className="flex flex-col items-center gap-2">
									<FaSkull />
									<span>4</span>
								</li>
							</ul>
						</div>

						{/* Dual Lands */}
						<div className="w-full p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20">
							<h2 className="text-2xl font-bold underline underline-offset-2 decoration-white/50">
								Special Lands
							</h2>
							<ul className="flex flex-wrap gap-4 justify-between w-full mt-2 text-2xl">
								<li className="flex flex-col items-center gap-2 w-full">
									<CardModule />
									<CardModule />
								</li>
							</ul>
						</div>
					</div>
				)}
			</div>
		</>
	);
};

export default LandModule;
