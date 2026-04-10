import type { Route } from "./+types/home";
import { Welcome } from "../welcome/welcome";

export function meta({}: Route.MetaArgs) {
	return [
		{ title: "Board State: MTG Commander Companion" },
		{ name: "description", content: "Board State" },
	];
}

export default function Home() {
	return <Welcome />;
}
