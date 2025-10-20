import { Link } from 'react-router';

function Welcome() {
	return (
		<div className="flex flex-col items-center justify-center h-screen">
			<div
				className="bg-white/10 backdrop-blur-2xl p-48 text-center rounded-3xl"
				id="welcome-screen">
				<div className="py-8">
					<h1 className="text-5xl font-bold text-white">
						Welcome to{' '}
						<span className="bg-gradient-to-br block from-primary to-secondary bg-clip-text text-transparent">
							BOARDSTATE
						</span>
					</h1>
					<h2 className="text-5xl tracking-widest">☀️💧💀🏔️🌳</h2>
				</div>
				<div className="flex flex-col gap-2" id="button-group">
					<Link to={'/games/new'}>
						<button className="btn btn-primary btn-md w-full">
							Create New Game
						</button>
					</Link>
					<Link to={'/games/join'}>
						<button className="btn btn-secondary btn-outline btn-md w-full">
							Join Game
						</button>
					</Link>
				</div>
			</div>
		</div>
	);
}

export default Welcome;
