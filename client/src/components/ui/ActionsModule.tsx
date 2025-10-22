import React from 'react';

const ActionsModule = () => {
	const openCastingModal = () => {
		const modal = document.getElementById('my_modal_3') as HTMLDialogElement;
		modal?.showModal();
	};
	return (
		<div className="fab">
			{/* a focusable div with tabIndex is necessary to work on all browsers. role="button" is necessary for accessibility */}
			<div tabIndex={0} role="button" className="btn btn-lg  btn-primary">
				Actions
			</div>

			{/* buttons that show up when FAB is open */}
			<button onClick={openCastingModal} className="btn btn-lg btn-secondary ">
				Cast
			</button>
			<button className="btn btn-lg btn-info ">Mana</button>
			<button className="btn btn-lg ">Some Third Thing</button>
		</div>
	);
};

export default ActionsModule;
