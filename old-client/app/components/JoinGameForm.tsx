import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router';
import { BACKEND_URL } from '~/utils/backend';

const JoinGameForm = () => {
	const [formData, setFormData] = useState({
		gameCode: '',
		playerName: '',
		email: '',
		playerType: 'anonymous',
	});
	const navigate = useNavigate();
	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		toast.loading('Joining game...');
		const response = await fetch(
			`${BACKEND_URL}/api/games/${formData.gameCode}/players/add-player`,
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(formData),
			}
		);
		const data = await response.json();
		if (response.ok) {
			toast.success(data.message);
			toast.dismiss();
			navigate(
				`/games/${formData.gameCode}/players/${data.player.player_uuid}`
			);
		} else {
			toast.error(data.error);
			toast.dismiss();
		}
	};

	return (
		<form className="" onSubmit={handleSubmit}>
			<label htmlFor="gameCode" className="label">
				<span className="label-text">Game Code</span>
			</label>
			<input
				type="text"
				placeholder="Game Code"
				className="input input-primary mb-4 w-full"
				value={formData.gameCode}
				onChange={(e) => setFormData({ ...formData, gameCode: e.target.value })}
			/>
			<label htmlFor="playerName" className="label">
				<span className="label-text">Player Name</span>
			</label>
			<input
				type="text"
				placeholder="Player Name"
				className="input input-primary mb-4 w-full"
				value={formData.playerName}
				onChange={(e) =>
					setFormData({ ...formData, playerName: e.target.value })
				}
			/>
			<label htmlFor="email" className="label">
				<span className="label-text">Email</span>
			</label>
			<input
				type="email"
				placeholder="Email"
				className="input input-primary mb-4 w-full"
				value={formData.email}
				onChange={(e) => setFormData({ ...formData, email: e.target.value })}
			/>
			<button type="submit" className="btn btn-primary w-full">
				Join Game
			</button>
		</form>
	);
};

export default JoinGameForm;
