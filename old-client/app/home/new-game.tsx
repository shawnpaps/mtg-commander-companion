import CreateNewGameForm from '../components/CreateNewGameForm';

export default function CreateNewGame() {
	return (
		<div className="flex flex-col items-center justify-center gap-4 min-h-[40rem]">
			<h1 className="text-4xl font-bold">Create New Game</h1>
			<CreateNewGameForm />
		</div>
	);
}
