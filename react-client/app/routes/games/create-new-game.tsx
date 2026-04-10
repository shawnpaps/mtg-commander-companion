import { useState } from "react";
import { useNavigate } from "react-router";

export function meta({}: Route.MetaArgs) {
	return [
		{ title: "Board State | Create New Game" },
		{ name: "description", content: "Board State" },
	];
}

interface NewGameForm {
	gameId: string;
	gameName: string;
	playerName: string;
	format: string;
	numPlayers: number;
	lifeTotal: number;
}

const generateGameId = (length = 8): string => {
	const chars =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	return Array.from(
		{ length },
		() => chars[Math.floor(Math.random() * chars.length)],
	).join("");
};

export default function CreateNewGame() {
	const navigate = useNavigate();
	const [formData, setFormData] = useState<NewGameForm>(() => ({
		gameId: generateGameId(),
		gameName: "",
		playerName: "",
		format: "commander",
		numPlayers: 0,
		lifeTotal: 0,
	}));

	const handleChange = (
		e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
	) => {
		const { name, value } = e.target;
		const fieldName = name as keyof NewGameForm;

		setFormData((prev) => ({
			...prev,
			[fieldName]:
				fieldName === "numPlayers" || fieldName === "lifeTotal"
					? Number(value)
					: value,
		}));
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		navigate(`/games/${formData.gameId}`);
	};

	return (
		<main className="w-screen h-screen bg-black flex items-center justify-center">
			<div className="w-full max-w-4xl bg-white rounded p-8">
				<h1 className="text-4xl font-semibold">Create New Game</h1>
				<NewGameForm
					gameId={formData.gameId}
					handleChange={handleChange}
					handleSubmit={handleSubmit}
				/>
			</div>
		</main>
	);
}

const NewGameForm = ({
	gameId,
	handleChange,
	handleSubmit,
}: {
	gameId: string;
	handleChange: (
		e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
	) => void;
	handleSubmit: (e: React.FormEvent) => void;
}) => {
	return (
		<form onSubmit={handleSubmit} className="mt-4 gap-4 flex flex-col">
			<input type="hidden" name="gameId" value={gameId} />
			<label className="text-sm font-medium text-gray-700">Game ID</label>
			<input
				type="text"
				value={gameId}
				disabled
				readOnly
				className="w-full p-2 border rounded bg-gray-300 text-gray-700"
			/>
			<label className="text-sm font-medium text-gray-700">Game Name</label>
			<input
				type="text"
				name="gameName"
				placeholder="Game Name"
				className="w-full p-2 border rounded"
				onChange={handleChange}
			/>
			<div className="flex gap-4">
				<label className="text-sm font-medium text-gray-700">Player Name</label>
				<input
					type="text"
					name="playerName"
					placeholder="Nicol Bolas"
					className="w-full p-2 border rounded"
					onChange={handleChange}
				/>

				<label className="text-sm font-medium text-gray-700">Format</label>
				<select
					className="w-full p-2 border rounded"
					name="format"
					onChange={handleChange}
				>
					<option value="commander">Commander</option>
					<option value="standard">Standard</option>
					<option value="vintage">Vintage</option>
					<option value="modern">Modern</option>
					<option value="legacy">Legacy</option>
				</select>
			</div>
			<div className="flex gap-4">
				<label className="text-sm font-medium text-gray-700">
					Number of Players
				</label>
				<input
					type="number"
					name="numPlayers"
					placeholder="Number of Players"
					className="w-full p-2 border rounded"
					onChange={handleChange}
				/>
				<label className="text-sm font-medium text-gray-700">Life Total</label>
				<input
					type="number"
					name="lifeTotal"
					placeholder="Life Total: 40"
					className="w-full p-2 border rounded"
					onChange={handleChange}
				/>
			</div>
			<button
				type="submit"
				className="inline-block rounded-sm border border-indigo-600 px-12 py-3 text-sm font-medium text-indigo-600 hover:bg-indigo-600 hover:text-white"
			>
				Create New Game
			</button>
		</form>
	);
};
