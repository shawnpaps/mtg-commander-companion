import React, { useState, useEffect } from 'react';
import { FaSearch, FaTimes, FaPlay, FaBookmark } from 'react-icons/fa';
import { BACKEND_URL } from '~/utils/backend';
import { toast } from 'react-hot-toast';

interface Card {
	id: string;
	name: string;
	mana_cost: string;
	type_line: string;
	oracle_text: string;
	image_uris: {
		normal: string;
		small: string;
	};
	colors: string[];
	cmc: number;
}

const SearchModule = ({ player }: { player: any }) => {
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const [searchResults, setSearchResults] = useState<Card[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [selectedCard, setSelectedCard] = useState<Card | null>(null);

	const handleSearch = async (query: string) => {
		if (!query.trim()) {
			setSearchResults([]);
			return;
		}

		setIsLoading(true);
		try {
			// Using Scryfall API for card search
			const response = await fetch(
				`https://api.scryfall.com/cards/search?q=${encodeURIComponent(
					query
				)}&unique=cards&order=name`
			);

			if (response.ok) {
				const data = await response.json();
				setSearchResults(data.data.slice(0, 20)); // Limit to 20 results
			} else {
				setSearchResults([]);
			}
		} catch (error) {
			console.error('Error searching cards:', error);
			setSearchResults([]);
		} finally {
			setIsLoading(false);
		}
	};

	const handleCastCard = (card: Card) => {
		// TODO: Implement card casting logic
		console.log('Casting card:', card.name);
		// You can add your casting logic here
		toast.custom((t) => (
			<div
				className={`${
					t.visible ? 'animate-enter' : 'animate-leave'
				} max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}>
				<div className="flex-1 w-0 p-4">
					<div className="flex items-start">
						<div className="flex-shrink -0 pt-0.5">
							<div className="ml-3 flex-1">
								<p className="text-sm font-medium text-gray-900">
									{player.player_name}
								</p>
								<p className="mt-1 text-sm text-gray-500">
									Casting {card.name}!
								</p>
							</div>
						</div>
					</div>
				</div>
				<div className="flex border-l border-gray-200">
					<button
						onClick={() => toast.dismiss(t.id)}
						className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-indigo-600 hover:text-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500">
						Close
					</button>
				</div>
			</div>
		));
		setIsModalOpen(false);
	};

	const handleSaveToCollection = (card: Card) => {
		// TODO: Implement save to collection logic
		console.log('Saving card to collection:', card.name);
		toast.custom((t) => (
			<div className="bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5">
				<div className="flex-1 w-0 p-4">
					<div className="flex items-start">
						<div className="flex-shrink-0 pt-0.5">
							<div className="ml-3 flex-1">Feature coming soon!</div>
						</div>
					</div>
				</div>
			</div>
		));
	};

	const handleClose = (e: React.MouseEvent) => {
		e.stopPropagation();
		setIsModalOpen(false);
		setSearchQuery('');
		setSearchResults([]);
		setSelectedCard(null);
	};

	// Debounced search
	useEffect(() => {
		const timeoutId = setTimeout(() => {
			handleSearch(searchQuery);
		}, 300);

		return () => clearTimeout(timeoutId);
	}, [searchQuery]);

	return (
		<>
			{/* Search Button */}
			<button
				onClick={() => setIsModalOpen(true)}
				className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors duration-200 shadow-lg hover:shadow-xl">
				<FaSearch className="w-4 h-4" />
				<span>Search Cards</span>
			</button>

			{/* Search Modal */}
			{isModalOpen && (
				<div className="fixed inset-0 w-full h-full bg-black/80 flex justify-center items-center z-50 p-4">
					<div className="relative bg-slate-800 backdrop-blur-md rounded-2xl border border-white/20 w-full max-w-4xl max-h-[90vh] overflow-hidden">
						{/* Header */}
						<div className="flex items-center justify-between p-6 border-b border-white/20">
							<h2 className="text-2xl font-bold text-white">Search Cards</h2>
							<button
								onClick={handleClose}
								className="text-white hover:text-red-400 transition-colors p-2">
								<FaTimes className="w-6 h-6" />
							</button>
						</div>

						{/* Search Input */}
						<div className="p-6 border-b border-white/20">
							<div className="relative">
								<FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
								<input
									type="text"
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									placeholder="Search for a card..."
									className="w-full pl-10 pr-4 py-3 bg-slate-700 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
									autoFocus
								/>
							</div>
						</div>

						{/* Search Results */}
						<div className="flex-1 overflow-y-auto p-6">
							{isLoading && (
								<div className="text-center py-8">
									<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
									<p className="text-white mt-2">Searching...</p>
								</div>
							)}

							{!isLoading && searchQuery && searchResults.length === 0 && (
								<div className="text-center py-8">
									<p className="text-gray-400">No cards found</p>
								</div>
							)}

							{!isLoading && searchResults.length > 0 && (
								<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
									{searchResults.map((card) => (
										<div
											key={card.id}
											className="bg-slate-700 rounded-lg p-4 border border-white/20 hover:border-blue-400/50 transition-colors cursor-pointer"
											onClick={() => setSelectedCard(card)}>
											{/* Card Image */}
											<div className="relative mb-3">
												<img
													src={card.image_uris.small}
													alt={card.name}
													className="w-full h-48 object-cover rounded-lg"
												/>
											</div>

											{/* Card Info */}
											<div className="space-y-2">
												<h3 className="font-bold text-white text-sm truncate">
													{card.name}
												</h3>
												<div className="flex items-center justify-between">
													<span className="text-gray-400 text-xs">
														{card.type_line}
													</span>
													{card.mana_cost && (
														<span className="text-blue-400 text-xs">
															{card.mana_cost}
														</span>
													)}
												</div>
											</div>
										</div>
									))}
								</div>
							)}
						</div>

						{/* Selected Card Actions */}
						{selectedCard && (
							<div className="p-6 border-t border-white/20 bg-slate-700">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-4">
										<img
											src={selectedCard.image_uris.small}
											alt={selectedCard.name}
											className="w-16 h-20 object-cover rounded-lg"
										/>
										<div>
											<h3 className="font-bold text-white">
												{selectedCard.name}
											</h3>
											<p className="text-gray-400 text-sm">
												{selectedCard.type_line}
											</p>
										</div>
									</div>
									<div className="flex gap-2">
										<button
											onClick={() => handleCastCard(selectedCard)}
											className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors">
											<FaPlay className="w-4 h-4" />
											Cast
										</button>
										<button
											onClick={() => handleSaveToCollection(selectedCard)}
											disabled
											className="flex items-center gap-2 bg-gray-600 text-gray-400 px-4 py-2 rounded-lg cursor-not-allowed opacity-50">
											<FaBookmark className="w-4 h-4" />
											Save
										</button>
									</div>
								</div>
							</div>
						)}
					</div>
				</div>
			)}
		</>
	);
};

// Simple toast function (you can replace with your preferred toast library)

export default SearchModule;
