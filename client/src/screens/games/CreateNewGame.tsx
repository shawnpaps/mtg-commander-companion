import React from 'react';
import CreateNewGameForm from '../../components/forms/CreateNewGameForm';

const CreateNewGame = () => {
	return (
		<div className="flex-col flex items-center justify-center h-screen">
			<div>
				<h1 className="text-4xl font-semibold">Create a New Game</h1>
				<p>It's time to sling some spells</p>
			</div>

			<div className="glass rounded-3xl p-10">
				<CreateNewGameForm />
			</div>
		</div>
	);
};

export default CreateNewGame;
