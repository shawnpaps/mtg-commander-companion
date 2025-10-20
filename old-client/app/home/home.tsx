import { Link } from 'react-router';
import type { Route } from './+types/home';

export default function Home() {
	return (
		<>
			<div className="flex flex-col items-center justify-center gap-4 min-h-[40rem]">
				<Link to="/new-game" className="btn btn-primary">
					Start a new game
				</Link>
				<span className="text-lg font-bold">or</span>
				<Link to="/join-game" className="btn btn-primary">
					Join a game
				</Link>
			</div>
		</>
	);
}
