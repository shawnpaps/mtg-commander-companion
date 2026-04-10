import { useState } from "react";
import { FaBook } from "react-icons/fa";
import { GiHastyGrave } from "react-icons/gi";
import { TbXxx } from "react-icons/tb";

export default function PlayerScreen() {
	return (
		<section className="h-screen relative">
			<StatusBar lifeCount={40} />
			<PlayerCardDropdown cardType="creatures" />
			<PlayerCardDropdown cardType="artifacts" />
			<PlayerCardDropdown cardType="enchantments" />
			<PlayerCardDropdown cardType="planeswalkers" />
			<BottomBar
				playerName="Nicol Bolas"
				libraryCount={99}
				graveyardCount={0}
				exileCount={0}
			/>
		</section>
	);
}

interface BottomBarProps {
	playerName: string;
	libraryCount: number;
	graveyardCount: number;
	exileCount: number;
}

function BottomBar({
	playerName,
	libraryCount,
	graveyardCount,
	exileCount,
}: BottomBarProps) {
	return (
		<div className="absolute bottom-20 left-0 w-full  px-4">
			<section className="flex items-center justify-end w-full mb-4">
				<div className=" flex flex-col items-center justify-between gap-2">
					<button className="rounded-sm w-48 border border-indigo-600 bg-indigo-600 px-12 py-4 text-sm font-medium text-white hover:bg-transparent hover:text-indigo-600">
						Cast
					</button>
					<button className="rounded-sm border w-48 border-indigo-600 bg-indigo-600 px-12 py-4 text-sm font-medium text-white hover:bg-transparent hover:text-indigo-600">
						Pass
					</button>
					<button className="rounded-sm border w-48 border-indigo-600 bg-indigo-600 px-12 py-4 text-sm font-medium text-white hover:bg-transparent hover:text-indigo-600">
						Counter!
					</button>
				</div>
			</section>
			<section className="flex items-center justify-between w-full">
				<h1 className="text-4xl  font-bold tracking-tighter ">{playerName}</h1>
				<div className="flex gap-4">
					<div className="text-2xl bg-gray-200 p-4">
						<FaBook />
						<span className="text-lg">{libraryCount}</span>
					</div>
					<div className="text-2xl bg-gray-200 p-4">
						<GiHastyGrave />
						<span className="text-lg">{graveyardCount}</span>
					</div>
					<div className="text-2xl bg-gray-200 p-4">
						<TbXxx />
						<span className="text-lg">{exileCount}</span>
					</div>
				</div>
			</section>
		</div>
	);
}

interface PlayerCardDropdownProps {
	cardType: "creatures" | "artifacts" | "enchantments" | "planeswalkers";
}

function PlayerCardDropdown({ cardType }: PlayerCardDropdownProps) {
	const [isExpanded, setIsExpanded] = useState(false);
	return (
		<>
			<button
				onClick={() => setIsExpanded(!isExpanded)}
				className="flex gap-4 p-4 w-full bg-gray-200"
			>
				<div className="w-full flex items-center justify-between">
					<h2>{cardType}</h2>
					<p>{isExpanded ? "-" : "+"}</p>
				</div>
			</button>
			{isExpanded && (
				<section>
					<h1>I'm Expanded</h1>
				</section>
			)}
		</>
	);
}

interface StatusBarProps {
	lifeCount: number;
}

function StatusBar({ lifeCount }: StatusBarProps) {
	return (
		<div className="flex p-5 border-b-2 mb-0 items-center justify-between w-full px-4 bg-gray-200">
			<p>test</p>
			<p className="text-3xl font-bold">{lifeCount}</p>
		</div>
	);
}
