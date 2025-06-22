import React from 'react';
import type { Route } from './+types/DashboardLayout';
import { Outlet } from 'react-router';

export function meta({}: Route.MetaArgs) {
	return [
		{ title: 'Dashboard' },
		{ name: 'description', content: 'Dashboard' },
	];
}

const DashboardLayout = () => {
	return (
		<main className="pt-16 p-4 container mx-auto flex flex-col items-center justify-center max-w-screen-md">
			<Outlet />
		</main>
	);
};

export default DashboardLayout;
