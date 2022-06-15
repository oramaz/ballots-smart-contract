// 0x5d7322C0A5C2347A6ca342E786fa66768e1F82BC

task('start-vote', 'Creates a new ballot (only owner)')
	.addParam('contract', 'Contract address')
	.addOptionalParam('from', 'Creator address')
	.addParam('proposals', 'Proposals adresses list (separated by commas)')
	.setAction(async (args) => {
		let contract = await ethers.getContractAt('Ballots', args.contract);
		if (args.from) {
			contract = contract.connect(ethers.provider.getSigner(args.from));
		}

		const tx = await contract.createBallot(args.proposals.split(','));
		const rc = await tx.wait();
		const event = rc.events.find((event) => event.event === 'BallotStarting');
		const [id, proposals, creator] = event.args;

		console.log(`The vote (id: ${id}) was started by ${creator}`);
		console.log(`Proposals: ${proposals}`);
	});

task('vote', 'Sends vote into the ballot')
	.addParam('contract', 'Contract address')
	.addOptionalParam('from', 'Voter address')
	.addParam('id', 'Ballot ID')
	.addParam('proposal', 'Proposal address')
	.setAction(async (args) => {
		let contract = await ethers.getContractAt('Ballots', args.contract);
		if (args.from) {
			contract = contract.connect(ethers.provider.getSigner(args.from));
		}

		const tx = await contract.vote(args.id, args.proposal, {
			value: ethers.utils.parseEther('0.01'),
		});
		const rc = await tx.wait();
		const event = rc.events.find((event) => event.event === 'Vote');
		const [voter, id] = event.args;

		console.log(`The vote from ${voter} was sent into the ballot (id: ${id})`);
	});

task('end-vote', 'Completes existing ballot')
	.addParam('contract', 'Contract address')
	.addOptionalParam('from', 'Account address')
	.addParam('id', 'Ballot ID')
	.setAction(async (args) => {
		let contract = await ethers.getContractAt('Ballots', args.contract);
		if (args.from) {
			contract = contract.connect(ethers.provider.getSigner(args.from));
		}

		const tx = await contract.completeBallot(args.id);
		const rc = await tx.wait();
		const event = rc.events.find((event) => event.event === 'BallotCompletion');
		const [id, winners, by] = event.args;

		console.log(`The vote (id: ${id}) was completed by ${by}`);
		console.log(`Winners (${winners.length}): ${winners}`);
	});

task('withdraw', 'Withdraws the fee (only owner)')
	.addParam('contract', 'Contract address')
	.addOptionalParam('from', 'Account address')
	.setAction(async (args) => {
		let contract = await ethers.getContractAt('Ballots', args.contract);
		if (args.from) {
			contract = contract.connect(ethers.provider.getSigner(args.from));
		}

		const tx = await contract.withdrawFee();
		tx.wait();

		console.log(`The fee has been withdrawed`);
	});
