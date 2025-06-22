import React, { useState } from 'react';
import { FaTimes } from 'react-icons/fa';

const CardModule = () => {
	const [isModalOpen, setIsModalOpen] = useState(false);
	return (
		<>
			<div
				className="bg-white/10 backdrop-blur-md rounded-2xl p-6  border border-white/20 w-full h-32 z-30"
				onClick={() => setIsModalOpen(true)}>
				<div className="flex items-center gap-3 mb-3">
					<h3 className="text-xl font-bold text-white">Card</h3>
				</div>
			</div>
			{isModalOpen && (
				<div className="fixed inset-0 h- w-full bg-black/80 rounded-xl bg-opacity-50 flex justify-center items-center z-50">
					<div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 w-full h-full">
						<button
							className="absolute top-4 right-4 text-4xl"
							onClick={() => setIsModalOpen(false)}>
							<FaTimes />
						</button>
						<div className="flex items-center gap-3 mb-3">
							<h3 className="text-xl font-bold text-white">Card</h3>
						</div>
					</div>
				</div>
			)}
		</>
	);
};

export default CardModule;
