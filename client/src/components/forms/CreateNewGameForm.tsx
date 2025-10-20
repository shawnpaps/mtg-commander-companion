import React, { useState, useRef } from 'react';
import { useFormik } from 'formik';
import { searchForPlayer } from '../../utils/player-functions';
import { createNewGame } from '../../utils/game-functions';

const CreateNewGameForm = () => {
	const [searchPlayer, setSearchPlayer] = useState(false);
	const [createPlayer, setCreatePlayer] = useState(false);
	const formik = useFormik({
		initialValues: {
			playerName: 'Nicol Bolas',
			playerId: '',
			playerUsername: '',
			gameName: '',
			gameType: 'commander',
		},
		onSubmit: async (values) => {
			alert(JSON.stringify(values, null, 2));
			const result = await createNewGame(values);
			console.log(result);
		},
	});

	const handleSearchPlayer = () => {
		setCreatePlayer(false);
		setSearchPlayer(true);
	};
	const handleCreatePlayer = () => {
		setCreatePlayer(false);
		setSearchPlayer(false);
	};
	return (
		<form onSubmit={formik.handleSubmit}>
			<label className="font-semibold" htmlFor="playerName">
				Who's Playing?
			</label>

			{/* Show selected player */}
			{formik.values.playerId && (
				<div className="bg-success/20 p-3 rounded mb-4">
					<p className="text-success font-semibold">Selected Player:</p>
					<p>{formik.values.playerName}</p>
					<button
						type="button"
						className="btn btn-sm btn-outline"
						onClick={() => {
							formik.setFieldValue('playerName', '');
							formik.setFieldValue('playerId', '');
						}}>
						Change Player
					</button>
				</div>
			)}

			{searchPlayer || createPlayer ? (
				<div>
					{searchPlayer && (
						<SearchPlayer
							onPlayerSelect={(player) => {
								formik.setFieldValue('playerName', player.name);
								formik.setFieldValue('playerId', player._id);
								formik.setFieldValue('playerUsername', player.username);
								setSearchPlayer(false); // Close search component after selection
							}}
						/>
					)}
				</div>
			) : (
				<div className="flex gap-2">
					<button
						onClick={handleSearchPlayer}
						type="button"
						id="search-player"
						className="btn btn-primary">
						I've Played Before
					</button>
					<button
						type="button"
						id="create-new-player"
						className="btn btn-accent btn-outline">
						I'm New Here
					</button>
				</div>
			)}

			<label className="font-semibold" htmlFor="gameName">
				Give your game a name:
			</label>
			<input
				id="gameName"
				name="gameName"
				className="input input-primary"
				type="text"
				onChange={formik.handleChange}
				value={formik.values.gameName}
			/>
			<button type="submit">Submit</button>
		</form>
	);
};

export default CreateNewGameForm;

interface Player {
	_id: string;
	name: string;
	username: string;
	games_played: number;
}

interface SearchPlayerProps {
	onPlayerSelect: (player: Player) => void;
}

const SearchPlayer = ({ onPlayerSelect }: SearchPlayerProps) => {
	const [searchParam, setSearchParam] = useState('');
	const [searchResults, setSearchResults] = useState<Player[]>([]);

	const handleSearch = async (e: React.FormEvent) => {
		e.preventDefault();
		console.log('Searching for:', searchParam);
		try {
			const results = await searchForPlayer(searchParam);
			console.log('Search results:', results);
			setSearchResults(results as Player[]);
		} catch (error) {
			console.error('Search failed:', error);
			setSearchResults([]);
		}
	};

	const handleSelectPlayer = (player: Player) => {
		onPlayerSelect(player);
	};

	return (
		<div className="">
			<input
				className="input input-primary"
				value={searchParam}
				placeholder="Search for a player"
				onChange={(e) => setSearchParam(e.target.value)}
			/>
			<button onClick={handleSearch} className="btn">
				Search
			</button>
			<div className="overflow-x-auto mt-4">
				<table className="table bg-black">
					{/* head */}
					<thead>
						<tr>
							<th></th>
							<th>Username</th>
							<th>Name</th>
							<th>Games Played</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						{searchResults?.map((result: Player, idx: number) => (
							<tr key={result._id}>
								<th>{idx}</th>
								<td>{result.username}</td>
								<td>{result.name}</td>
								<td>{result.games_played}</td>
								<td>
									<button
										type="button"
										className="btn btn-success btn-sm"
										onClick={() => handleSelectPlayer(result)}>
										Add Player
									</button>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
};
