require('@nomiclabs/hardhat-waffle');
require('@nomiclabs/hardhat-etherscan');
require('solidity-coverage');
require('dotenv').config();
require('./tasks/Ballots/index.js');

task('balance', "Prints an account's balance")
	.addParam('account', "The account's address")
	.setAction(async (taskArgs) => {
		const account = web3.utils.toChecksumAddress(taskArgs.account);
		const balance = await web3.eth.getBalance(account);

		await web3.eth.getAccounts().then((e) => console.log(e));

		console.log(web3.utils.fromWei(balance, 'ether'), 'ETH');
	});

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
	networks: {
		rinkeby: {
			url: `https://rinkeby.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
			accounts: [
				process.env.OWNER_PRIVATE,
				process.env.ACCOUNT2_PRIVATE,
				process.env.ACCOUNT3_PRIVATE,
			],
		},
	},

	solidity: {
		version: '0.8.0',
	},
	paths: {
		sources: './contracts',
		tests: './test',
		cache: './cache',
		artifacts: './artifacts',
	},
	mocha: {
		timeout: 40000,
	},
	etherscan: {
		apiKey: process.env.ETHERSCAN_API_KEY,
	},
};
