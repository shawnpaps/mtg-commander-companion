'use client';

import Link from 'next/link';
import { useState } from 'react';
import WebsiteLayout from './layouts/WebsiteLayout';

export default function Home() {
	const [playerName, setPlayerName] = useState('');
	const [isStarting, setIsStarting] = useState(false);

	const handleAnonymousStart = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!playerName.trim()) return;

		setIsStarting(true);
		console.log('Starting game for:', playerName);

		setTimeout(() => {
			setIsStarting(false);
		}, 1000);
	};

	return (
		<WebsiteLayout>
			<div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
				{/* Background decoration */}
				<div className="absolute inset-0 overflow-hidden pointer-events-none">
					<div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
					<div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
					<div className="absolute top-40 left-40 w-80 h-80 bg-pink-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
				</div>

				<div className="relative max-w-2xl w-full space-y-8 z-10">
					{/* Header */}
					<div className="text-center space-y-6">
						<div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full shadow-lg mb-6">
							<svg
								className="w-10 h-10 text-white"
								fill="currentColor"
								viewBox="0 0 20 20">
								<path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
						</div>
						<h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
							MTG Commander
						</h1>
						<h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
							Companion
						</h2>
						<p className="text-xl text-gray-600 dark:text-gray-300 max-w-md mx-auto">
							Master your commander games with precision tracking and beautiful
							insights
						</p>
					</div>

					{/* Main Content Cards */}
					<div className="grid md:grid-cols-2 gap-6">
						{/* Anonymous Game Form */}
						<div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 dark:border-gray-700/50 p-8 hover:shadow-2xl transition-all duration-300">
							<div className="flex items-center mb-6">
								<div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center mr-4">
									<svg
										className="w-5 h-5 text-white"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24">
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M12 6v6m0 0v6m0-6h6m-6 0H6"
										/>
									</svg>
								</div>
								<h2 className="text-2xl font-bold text-gray-900 dark:text-white">
									Quick Start
								</h2>
							</div>
							<form onSubmit={handleAnonymousStart} className="space-y-6">
								<div>
									<label
										htmlFor="playerName"
										className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
										Enter your name
									</label>
									<input
										id="playerName"
										type="text"
										value={playerName}
										onChange={(e) => setPlayerName(e.target.value)}
										placeholder="Your name"
										className="w-full px-4 py-3 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm transition-all duration-200"
										required
									/>
								</div>
								<button
									type="submit"
									disabled={isStarting || !playerName.trim()}
									className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-6 rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl">
									{isStarting ? (
										<div className="flex items-center justify-center">
											<div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
											Starting Game...
										</div>
									) : (
										'Start Game Anonymously'
									)}
								</button>
							</form>
						</div>

						{/* Login Option */}
						<div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 p-8 hover:shadow-2xl transition-all duration-300">
							<div className="flex items-center mb-6">
								<div className="w-10 h-10 bg-gradient-to-r from-gray-600 to-gray-700 rounded-lg flex items-center justify-center mr-4">
									<svg
										className="w-5 h-5 text-white"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24">
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
										/>
									</svg>
								</div>
								<h3 className="text-2xl font-bold text-gray-900 dark:text-white">
									Your Profile
								</h3>
							</div>
							<div className="space-y-4 mb-6">
								<p className="text-gray-600 dark:text-gray-300">
									Login to unlock premium features and save your game history
								</p>
								<ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
									<li className="flex items-center">
										<svg
											className="w-4 h-4 text-green-500 mr-2"
											fill="currentColor"
											viewBox="0 0 20 20">
											<path
												fillRule="evenodd"
												d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
												clipRule="evenodd"
											/>
										</svg>
										Game history & statistics
									</li>
									<li className="flex items-center">
										<svg
											className="w-4 h-4 text-green-500 mr-2"
											fill="currentColor"
											viewBox="0 0 20 20">
											<path
												fillRule="evenodd"
												d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
												clipRule="evenodd"
											/>
										</svg>
										Personalized settings
									</li>
									<li className="flex items-center">
										<svg
											className="w-4 h-4 text-green-500 mr-2"
											fill="currentColor"
											viewBox="0 0 20 20">
											<path
												fillRule="evenodd"
												d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
												clipRule="evenodd"
											/>
										</svg>
										Cross-device sync
									</li>
								</ul>
							</div>
							<Link
								href="/login"
								className="w-full inline-flex justify-center items-center bg-gradient-to-r from-gray-700 to-gray-800 text-white py-3 px-6 rounded-xl font-semibold hover:from-gray-800 hover:to-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl">
								Login to Your Account
							</Link>
						</div>
					</div>

					{/* Features Grid */}
					<div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
						<div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-2xl p-6 border border-blue-200/50 dark:border-blue-700/30 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
							<div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-4">
								<svg
									className="w-6 h-6 text-white"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24">
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
									/>
								</svg>
							</div>
							<h4 className="text-lg font-bold text-blue-900 dark:text-blue-100 mb-2">
								Life Tracking
							</h4>
							<p className="text-blue-700 dark:text-blue-300 text-sm">
								Real-time life total management with beautiful visual indicators
							</p>
						</div>

						<div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-2xl p-6 border border-green-200/50 dark:border-green-700/30 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
							<div className="w-12 h-12 bg-gradient-to-r from-green-500 to-green-600 rounded-xl flex items-center justify-center mb-4">
								<svg
									className="w-6 h-6 text-white"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24">
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M13 10V3L4 14h7v7l9-11h-7z"
									/>
								</svg>
							</div>
							<h4 className="text-lg font-bold text-green-900 dark:text-green-100 mb-2">
								Commander Damage
							</h4>
							<p className="text-green-700 dark:text-green-300 text-sm">
								Track commander damage between all players with precision
							</p>
						</div>

						<div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-2xl p-6 border border-purple-200/50 dark:border-purple-700/30 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
							<div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mb-4">
								<svg
									className="w-6 h-6 text-white"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24">
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
									/>
								</svg>
							</div>
							<h4 className="text-lg font-bold text-purple-900 dark:text-purple-100 mb-2">
								Game History
							</h4>
							<p className="text-purple-700 dark:text-purple-300 text-sm">
								Save and analyze your games with detailed statistics
							</p>
						</div>
					</div>
				</div>
			</div>

			<style jsx>{`
				@keyframes blob {
					0% {
						transform: translate(0px, 0px) scale(1);
					}
					33% {
						transform: translate(30px, -50px) scale(1.1);
					}
					66% {
						transform: translate(-20px, 20px) scale(0.9);
					}
					100% {
						transform: translate(0px, 0px) scale(1);
					}
				}
				.animate-blob {
					animation: blob 7s infinite;
				}
				.animation-delay-2000 {
					animation-delay: 2s;
				}
				.animation-delay-4000 {
					animation-delay: 4s;
				}
			`}</style>
		</WebsiteLayout>
	);
}
