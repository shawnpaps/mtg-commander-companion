import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { BACKEND_URL } from '~/utils/backend';
import { useNavigate } from 'react-router';

const CreateNewGameForm = () => {
	const navigate = useNavigate();
	const [formData, setFormData] = useState({
		playerName: '',
		email: '',
		playerType: 'anonymous',
	});

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		toast.loading('Creating game...');
		const response = await fetch(`${BACKEND_URL}/api/games`, {
			method: 'POST',
			body: JSON.stringify(formData),
			headers: {
				'Content-Type': 'application/json',
			},
		});
		const data = await response.json();
		if (response.status === 201) {
			toast.success('Game created successfully');
			console.log(data);
			navigate(
				`/games/${data.game.game_uuid}/players/${data.player.player_uuid}`
			);
			toast.dismiss();
		} else {
			toast.error('Failed to create game');
		}
	};

	return (
		<form
			onSubmit={handleSubmit}
			className="flex flex-col gap-4 w-full max-w-md bg-base-100 p-4 rounded-md">
			<div className="form-control">
				<label className="label">
					<span className="label-text text-lg font-bold">Player Name</span>
				</label>
				<input
					type="text"
					placeholder="MasterMage69"
					className="input input-primary w-full input-lg"
					value={formData.playerName}
					onChange={(e) =>
						setFormData({ ...formData, playerName: e.target.value })
					}
				/>
				<label className="label">Email Address</label>
				<input
					type="email"
					placeholder="mastermage69@gmail.com"
					className="input input-primary w-full input-lg"
					value={formData.email}
					onChange={(e) => setFormData({ ...formData, email: e.target.value })}
				/>
			</div>
			<button type="submit" className="btn btn-primary w-full">
				Create Game
			</button>
		</form>
	);
};

export default CreateNewGameForm;
