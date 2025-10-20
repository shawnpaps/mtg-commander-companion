import React from 'react';
import { Link } from 'react-router';
import JoinGameForm from '~/components/JoinGameForm';

const JoinGame = () => {
	return (
		<div className="flex flex-col gap-4 w-full">
			<div className="card bg-base-100 shadow-xl w-full max-w-md">
				<div className="card-body">
					<h1 className="card-title">Join Game</h1>
					<JoinGameForm />
					<p className="mt-4">
						Don't have a game code?{' '}
						<Link to="/new-game" className="link block link-primary font-bold">
							Create a new game
						</Link>
					</p>
				</div>
			</div>
			<div className="">
				<Link to="/" className="btn btn-outline w-full font-bold">
					Back to Home
				</Link>
			</div>
		</div>
	);
};

export default JoinGame;
