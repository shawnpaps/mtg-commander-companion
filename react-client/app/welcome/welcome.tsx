import logoDark from "./logo-dark.svg";
import logoLight from "./logo-light.svg";

export function Welcome() {
	return (
		<main className="bg-black h-screen w-screen flex flex-col items-center justify-center text-white">
			<section className="max-w-screen-md text-center p-12 bg-white/10 backdrop-blur-sm">
				<div>
					<h1 className="text-4xl font-bold"> Welcome to Board State</h1>
					<p>The ultimate board state companion for Magic: The Gathering</p>
				</div>
				<div className="mt-8 flex gap-4 items-center w-full justify-center">
					<a
						class="group relative inline-flex items-center overflow-hidden rounded-sm bg-indigo-600 px-8 py-3 text-white"
						href="/games/create-new-game"
					>
						<span class="absolute -end-full transition-all group-hover:end-4">
							<svg
								class="size-5 rtl:rotate-180"
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M17 8l4 4m0 0l-4 4m4-4H3"
								></path>
							</svg>
						</span>

						<span class="text-sm font-medium transition-all group-hover:me-4">
							Start a Game
						</span>
					</a>
					<a
						class="group relative inline-flex items-center overflow-hidden rounded-sm outline-2 outline-indigo-500 px-8 py-3 text-white"
						href="#"
					>
						<span class="absolute -end-full transition-all group-hover:end-4">
							<svg
								class="size-5 rtl:rotate-180"
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M17 8l4 4m0 0l-4 4m4-4H3"
								></path>
							</svg>
						</span>

						<span class="text-sm font-medium transition-all group-hover:me-4">
							Join a Game
						</span>
					</a>
				</div>
			</section>
		</main>
	);
}
