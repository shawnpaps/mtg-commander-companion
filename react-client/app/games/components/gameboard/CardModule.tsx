import React, { useState } from 'react';
import { FaTimes } from 'react-icons/fa';

const CardModule = ({ cardData }: { cardData: any }) => {
	const [isModalOpen, setIsModalOpen] = useState(false);

	const handleClose = (e: React.MouseEvent) => {
		e.stopPropagation();
		setIsModalOpen(false);
	};

	return (
		<>
			<div
				className="bg-white/10 backdrop-blur-md rounded-2xl p-6  border border-white/20 w-full h-32 relative"
				onClick={() => setIsModalOpen(true)}>
				<img
					src={cardData.image_uris.normal}
					alt={cardData.name}
					className="w-full h-full object-cover absolute top-0 left-0 opacity-20 object-top rounded-2xl z-10 "
				/>
				<div className="flex items-center gap-3 mb-3">
					<h3 className="text-xl font-bold text-white">{cardData.name}</h3>
				</div>
			</div>
			{isModalOpen && (
				<div className="fixed inset-0 w-full h-full bg-black/80 flex justify-center items-center z-50">
					<div className="relative bg-white/20 backdrop-blur-md rounded-2xl p-6 border border-white/20 w-full h-full max-w-4xl max-h-4xl">
						<button
							className="absolute top-4 right-4 text-4xl text-white hover:text-red-400 transition-colors z-50 bg-black/50 rounded-full p-2"
							onClick={handleClose}>
							<FaTimes />
						</button>
						<img
							src={cardData.image_uris.normal}
							alt={cardData.name}
							className="w-full h-full object-contain rounded-2xl"
						/>
						<div className="absolute bottom-4 left-4">
							<h3 className="text-xl font-bold text-white bg-black/50 px-3 py-1 rounded-lg">
								{cardData.name}
							</h3>
						</div>
					</div>
				</div>
			)}
		</>
	);
};

export default CardModule;
