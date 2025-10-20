import React, { useState } from 'react';
import CardModule from './CardModule';

const CommandZoneModule = ({
	title,
	description,
	icon,
	classNames,
	textColor = 'text-emerald-50',
	descriptionColor = 'text-emerald-100/80',
	commanderData,
}: {
	title: string;
	description: string;
	icon: React.ReactNode;
	classNames: string;
	textColor?: string;
	descriptionColor?: string;
	commanderData?: any;
}) => {
	const [expanded, setExpanded] = useState(false);
	return (
		<>
			<div className={classNames}>
				<div className="w-full text-left">
					<div onClick={() => setExpanded(true)} className="cursor-pointer">
						<div className="flex items-center gap-3 mb-3">
							{icon}
							<h3 className={`text-xl font-bold ${textColor}`}>{title}</h3>
						</div>
						<p className={`text-sm ${descriptionColor}`}>{description}</p>
						<div className="flex flex-col items-start mt-2">
							<span className="text-sm font-bold text-white/80">
								Commander:
							</span>
							<h4 className="text-sm font-bold text-white/80">
								{commanderData.name}
							</h4>
						</div>
					</div>
					{expanded && (
						<div className="">
							<button
								className="btn btn-lg btn-primary block ml-auto mb-4"
								onClick={(e) => {
									e.stopPropagation();
									setExpanded(false);
								}}>
								Collapse
							</button>
							<div className="w-full">
								<div className="flex flex-row items-center justify-between mt-4 mb-2">
									<div className="flex flex-col items-start">
										<span className="text-2xl font-bold">Commander</span>
										<span className="text-sm font-bold text-white/80">
											{commanderData.name}
										</span>
									</div>
									<div className="flex flex-col items-center">
										<span className="text-2xl font-bold">0</span>
										<span className="text-sm font-bold">Command Tax</span>
									</div>
								</div>
								{/* Commander Card */}
								<CardModule cardData={commanderData} />
							</div>
							<div className="w-full flex gap-2 mt-4">
								{/* opponent's commander cards*/}

								<CardModule cardData={commanderData} />
								<CardModule cardData={commanderData} />
							</div>
						</div>
					)}
				</div>
			</div>
		</>
	);
};

export default CommandZoneModule;
