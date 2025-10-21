import { useState } from 'react';
import { searchForCardByName } from '../../utils/card-functions';

// Custom styles for text clamping
const clampStyles = {
	display: '-webkit-box',
	WebkitBoxOrient: 'vertical' as const,
	overflow: 'hidden',
};

interface Card {
	_id: string;
	scryfallId: string;
	name: string;
	manaCost?: string;
	cmc: number;
	typeLine: string;
	oracleText: string;
	colors: string[];
	colorIdentity: string[];
	set: string;
	setName: string;
	rarity: string;
	imageUris: {
		small?: string;
		normal?: string;
		large?: string;
		art_crop?: string;
	};
	prices: Record<string, string>;
	legalities: Record<string, string>;
	power?: string | null;
	toughness?: string | null;
	loyalty?: string | null;
	keywords: string[];
	layout: string;
	scryfallUri: string;
}

interface CastingModalProps {
	onCastNewSpell: (spell: any) => void;
}

const CastingModal = ({ onCastNewSpell }: CastingModalProps) => {
	const [cardName, setCardName] = useState('');
	const [searchResults, setSearchResults] = useState<Card[]>([]);
	const [isSearching, setIsSearching] = useState(false);

	const searchForSpell = async () => {
		if (!cardName.trim()) return;

		setIsSearching(true);
		try {
			const results = await searchForCardByName(cardName.trim());
			console.log(results);
			setSearchResults(results || []);
		} catch (error) {
			console.error('Search failed:', error);
			setSearchResults([]);
		} finally {
			setIsSearching(false);
		}
	};

	const handleKeyPress = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter') {
			e.preventDefault();
			searchForSpell();
		}
	};
	return (
		<dialog id="my_modal_3" className="modal">
			<div className="modal-box">
				<form method="dialog">
					{/* Close button */}
					<button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">
						✕
					</button>
				</form>
				<h3 className="font-bold text-lg">Cast a Spell</h3>
				<p className="py-4">Select a spell to cast</p>

				{/* Add your spell casting content here */}
				<div className="space-y-4">
					<div className="form-control">
						<input
							value={cardName}
							onChange={(e) => setCardName(e.target.value)}
							onKeyPress={handleKeyPress}
							type="text"
							placeholder="Search for a spell (e.g. Lightning Bolt, Counterspell)..."
							className="input input-bordered w-full"
							disabled={isSearching}
						/>
					</div>
					<div className="flex gap-2">
						<button
							onClick={searchForSpell}
							className={`btn btn-primary ${isSearching ? 'loading' : ''}`}
							disabled={isSearching || !cardName.trim()}>
							{isSearching ? 'Searching...' : 'Search'}
						</button>
						{cardName && (
							<button
								onClick={() => {
									setCardName('');
									setSearchResults([]);
								}}
								className="btn btn-ghost"
								disabled={isSearching}>
								Clear
							</button>
						)}
					</div>
				</div>
				<section>
					{isSearching ? (
						<div className="text-center py-8">
							<span className="loading loading-spinner loading-lg"></span>
							<p className="text-base-content/60 mt-2">
								Searching for cards...
							</p>
						</div>
					) : (
						<ResultsGrid
							searchResults={searchResults}
							onCastNewSpell={onCastNewSpell}
						/>
					)}
				</section>
			</div>
		</dialog>
	);
};

export default CastingModal;

interface ResultsGridProps {
	searchResults: Card[];
	onCastNewSpell: (spell: any) => void;
}

const ResultsGrid = ({ searchResults, onCastNewSpell }: ResultsGridProps) => {
	return (
		<div className="mt-6">
			{searchResults.length === 0 ? (
				<div className="text-center py-8">
					<p className="text-base-content/60">No cards found</p>
					<p className="text-sm text-base-content/40 mt-1">
						Try searching for a different spell
					</p>
				</div>
			) : (
				<div>
					<h4 className="font-semibold text-lg mb-4">
						Found {searchResults.length} card
						{searchResults.length !== 1 ? 's' : ''}
					</h4>
					<div className="carousel carousel-center max-w-full space-x-4 p-4 bg-base-200 rounded-box">
						{searchResults.map((spell) => (
							<div key={spell._id} className="carousel-item flex-none">
								<div className="card bg-base-100 w-72 shadow-lg hover:shadow-xl transition-all duration-200 border border-base-300">
									<figure className="px-4 pt-4">
										<img
											src={
												spell.imageUris?.normal ||
												spell.imageUris?.large ||
												spell.imageUris?.small
											}
											alt={`${spell.name} card`}
											className="rounded-lg w-full h-48 object-cover"
											loading="lazy"
										/>
									</figure>
									<div className="card-body p-4">
										<h3
											className="card-title text-base font-bold mb-2"
											style={{
												...clampStyles,
												WebkitLineClamp: 1,
											}}
											title={spell.name}>
											{spell.name}
										</h3>
										<div className="flex items-center gap-2 mb-2 flex-wrap">
											<span className="badge badge-outline text-xs">
												{spell.typeLine}
											</span>
											{spell.manaCost && (
												<span className="text-xs text-base-content/60 font-mono bg-base-200 px-1 rounded">
													{spell.manaCost}
												</span>
											)}
											<span className="badge badge-ghost text-xs">
												{spell.rarity}
											</span>
										</div>
										<p
											className="text-sm text-base-content/80 mb-3"
											style={{
												...clampStyles,
												WebkitLineClamp: 3,
											}}
											title={spell.oracleText}>
											{spell.oracleText}
										</p>
										<div className="card-actions justify-end">
											<button
												className="btn btn-primary btn-sm"
												onClick={() => {
													onCastNewSpell(spell);
													// Close the modal
													const modal = document.getElementById(
														'my_modal_3'
													) as HTMLDialogElement;
													modal?.close();
												}}>
												Cast Spell
											</button>
										</div>
									</div>
								</div>
							</div>
						))}
					</div>
					<div className="text-center mt-4">
						<p className="text-xs text-base-content/40">
							Swipe horizontally to browse cards
						</p>
					</div>
				</div>
			)}
		</div>
	);
};
