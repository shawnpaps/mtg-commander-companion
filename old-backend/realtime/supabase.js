const channels = supabase
	.channel('custom-insert-channel')
	.on(
		'postgres_changes',
		{ event: 'INSERT', schema: 'public', table: 'player_game_logs' },
		(payload) => {
			console.log('Change received!', payload);
		}
	)
	.subscribe();
