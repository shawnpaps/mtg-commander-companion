import { useState } from "react";

export default function PlayerScreen() {
	return (
		<section className="h-screen relative">
			<StatusBar />
			<PlayerCardDropdown cardType="creatures" />
			<PlayerCardDropdown cardType="artifacts" />
			<PlayerCardDropdown cardType="enchantments" />
			<PlayerCardDropdown cardType="planeswalkers" />
			<BottomRow />
		</section>
	);
}

function BottomRow() {
	return (
		<div className="absolute bottom-20 left-0 flex items-center justify-between w-full px-4">
			<h1 className="text-4xl  font-bold tracking-tighter ">Player Name</h1>
			<div className="flex gap-4">
				<div className="text-2xl bg-gray-200 p-4">99</div>
				<div className="text-2xl bg-gray-200 p-4">0</div>
				<div className="text-2xl bg-gray-200 p-4">0</div>
			</div>
		</div>
	);
}

interface PlayerCardDropdownProps {
	cardType: "creatures" | "artifacts" | "enchantments" | "planeswalkers";
}

function PlayerCardDropdown({ cardType }: PlayerCardDropdownProps) {
	const [isExpanded, setIsExpanded] = useState(false);
	return (
		<div className="flex gap-4 p-4 w-full bg-gray-200">
			<div className="w-full flex items-center justify-between">
				<h2>{cardType}</h2>
				<p>+</p>
			</div>
		</div>
	);
}

function StatusBar() {
	return (
		<div className="flex p-5 border-b-2 mb-0 items-center justify-between w-full px-4 bg-gray-200">
			<p>test</p>
			<p className="text-3xl font-bold">40</p>
		</div>
	);
}
