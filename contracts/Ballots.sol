//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

contract Ballots {
	struct Ballot {
		address[] proposals;
		uint[] scores;
		uint256 fund;
		uint256 created;
		bool isCompleted;
		uint winnerScore;
		uint[] winnerIndexes;
	}

	address public owner;
	uint fee = 10;
	
	mapping(address => mapping(uint => address)) public voted;
	mapping(uint => Ballot) public ballots;
	
	uint256 ballotIDCounter;

	constructor() {
		owner = msg.sender;
	}

	modifier onlyOwner() {
		require(msg.sender == owner, "The sender doesn't have owner rights");
		_;
	}

	modifier ballotExists(uint bID) {
		require(ballots[bID].created > 0, "The ballot doesn't exist");
		_;
	}

	function createBallot(address[] memory proposalAddrs) onlyOwner public {
		require(proposalAddrs.length >= 2, "A new ballot should contain >= 2 proposals");
		uint256 id = ballotIDCounter++;

		ballots[id] = (Ballot({
			proposals: proposalAddrs, 
			scores: new uint[](proposalAddrs.length),
			created: block.timestamp,
			fund: 0,
			isCompleted: false,
			winnerScore: 0,
			winnerIndexes: new uint[](0)
		}));
	}

	function vote(uint ballotID, address proposalAddr) ballotExists(ballotID) payable public {
		Ballot memory ballot = ballots[ballotID];
		
		require(!ballot.isCompleted, "The ballot has already been completed");
		require(msg.value == 0.01 ether, "Need to deposit 0.01 ETH to vote");
		require(voted[msg.sender][ballotID] == address(0), "The voter has already voted");

		int proposalIndex = findProposalIndex(ballotID, proposalAddr);
		require(proposalIndex != -1, "There no such proposal in the ballot");

		ballots[ballotID].fund += 0.01 ether;

		ballots[ballotID].scores[uint(proposalIndex)] += 1;
		uint proposalScore = ballots[ballotID].scores[uint(proposalIndex)];
		
		if (proposalScore >= ballot.winnerScore) {
			if (proposalScore > ballot.winnerScore) {
				ballots[ballotID].winnerIndexes = new uint[](0);
				ballots[ballotID].winnerScore = proposalScore;
			}

			ballots[ballotID].winnerIndexes.push(uint(proposalIndex));
		}

		voted[msg.sender][ballotID] = proposalAddr;
	}

	function completeBallot(uint ballotID) ballotExists(ballotID) public {
		uint256 currentDate = block.timestamp;
		Ballot memory ballot = ballots[ballotID];

		require((currentDate - ballot.created) >= 3 days, "The ballot can be completed after 3 days only");
		
		ballots[ballotID].isCompleted = true;

		uint winnersCount = ballot.winnerIndexes.length;
		
		if (winnersCount > 0) {
			uint256 prizeFund = ballot.fund * (100 - fee) / 100;
			
			ballots[ballotID].fund -= prizeFund;
			
			uint256 proposalPrize = prizeFund / winnersCount;
			for (uint i = 0; i < winnersCount; i++) {
				address payable winner = payable(ballot.proposals[ballot.winnerIndexes[i]]);
				winner.transfer(proposalPrize);
			}
		}
	}

	function withdrawFee(uint ballotID) onlyOwner ballotExists(ballotID) public {
		require(ballots[ballotID].isCompleted, "The ballot hasn't been completed yet");
		
		payable(owner).transfer(ballots[ballotID].fund);

		ballots[ballotID].fund = 0;
	}

	function getBallotInfo(uint ballotID) ballotExists(ballotID) view public returns (Ballot memory) {
		return ballots[ballotID];
	}

	function getVoterBallotVote(address voter, uint ballotID) ballotExists(ballotID) view public returns (address) {
		return voted[voter][ballotID];
	}

	function findProposalIndex(uint ballotID, address proposalAddr) view internal returns (int256) {
		address[] memory proposals = ballots[ballotID].proposals;
		for (uint i = 0; i < proposals.length; i++){
			if (proposals[i] == proposalAddr) {
				return int256(i);
			}
		}
		return -1;
	}
}
