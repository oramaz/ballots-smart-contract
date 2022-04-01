//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

// Ballots provides the ability to maintain a list of ballots.
//
// Have fun reading it. Hopefully it's bug-free. God bless.
contract Ballots {
    // Info of each ballot.
    struct Ballot {
        address[] proposals; // Proposals' addresses list getting from ballot's creator.
        uint256[] scores; // Points of proposals. The index corresponds to the index
        // in the proposals array.
        uint256 fund; // The amount of money received from votes.
        uint256 created; // Date of creation of the ballot.
        bool isCompleted; // Has the ballot been completed.
        uint256 winnerScore; // The highest score.
        uint256[] winnerIndexes; // List of proposals having the highest score.
    }

    // Contract's owner address.
    address public owner;
    // Ballots fee (% of ballot's fund).
    uint256 fee = 10;
    // The cost that voter should pass to vote.
    uint256 voteCost = 0.01 ether;

    /*
     * Info of each voter's votes.
     * mapping(voter address => mapping(ballot ID => ballot's proposal address)).
     */
    mapping(address => mapping(uint256 => address)) public voted;
    // Info of each ballot.
    mapping(uint256 => Ballot) public ballots;
    // Generating unique ID for a new ballot.
    uint256 ballotIDCounter;

    // Make contract's deployer the owner.
    constructor() {
        owner = msg.sender;
    }

    // Require sender to be the owner.
    modifier onlyOwner() {
        require(msg.sender == owner, "The sender doesn't have owner rights");
        _;
    }
    // Require ballot to be existed.
    modifier ballotExists(uint256 bID) {
        require(ballots[bID].created > 0, "The ballot doesn't exist");
        _;
    }

    /**
     * @dev Creates a new ballot.
     *
     * Requirements:
     *
     * - the sender is the owner.
     * - 'proposalAddrs' contains more that 2 proposal addresses.
     */
    function createBallot(address[] memory proposalAddrs) public onlyOwner {
        require(
            proposalAddrs.length >= 2,
            "A new ballot should contain >= 2 proposals"
        );
        uint256 id = ballotIDCounter++;

        ballots[id] = (
            Ballot({
                proposals: proposalAddrs,
                scores: new uint256[](proposalAddrs.length),
                created: block.timestamp,
                fund: 0,
                isCompleted: false,
                winnerScore: 0,
                winnerIndexes: new uint256[](0)
            })
        );
    }

    /**
     * @dev Processes the recieved vote.
     *
     * Requirements:
     *
     * - the ballot with a 'ballotID' is exist.
     * - the ballot with a 'ballotID' is not completed.
     * - the sender paid 0.01 ETH.
     * - the sender hasn't already voted in the ballot.
     * - selected proposal is exists in the ballot's proposals list.
     */
    function vote(uint256 ballotID, address proposalAddr)
        public
        payable
        ballotExists(ballotID)
    {
        Ballot memory ballot = ballots[ballotID];

        require(!ballot.isCompleted, "The ballot has already been completed");
        require(msg.value == voteCost, "Need to deposit 0.01 ETH to vote");
        require(
            voted[msg.sender][ballotID] == address(0),
            "The voter has already voted"
        );
        // Get the index of the selected proposal.
        int256 proposalIndex = findProposalIndex(ballotID, proposalAddr);
        require(proposalIndex != -1, "There no such proposal in the ballot");

        ballots[ballotID].fund += voteCost;

        ballots[ballotID].scores[uint256(proposalIndex)] += 1;
        uint256 proposalScore = ballots[ballotID].scores[
            uint256(proposalIndex)
        ];

        // Change ballot's score records if the selected proposal has overtaken the existing top.
        // Or add selected proposal to the list of the winners if the score became equal.
        if (proposalScore >= ballot.winnerScore) {
            if (proposalScore > ballot.winnerScore) {
                ballots[ballotID].winnerIndexes = new uint256[](0);
                ballots[ballotID].winnerScore = proposalScore;
            }
            ballots[ballotID].winnerIndexes.push(uint256(proposalIndex));
        }

        voted[msg.sender][ballotID] = proposalAddr;
    }

    /**
     * @dev Completes the ballot.
     *
     * Requirements:
     *
     * - the ballot with a 'ballotID' is exist.
     * - it has been more than 3 days since the creation of the ballot.
     */
    function completeBallot(uint256 ballotID) public ballotExists(ballotID) {
        uint256 currentDate = block.timestamp;
        Ballot memory ballot = ballots[ballotID];

        require(
            (currentDate - ballot.created) >= 3 days,
            "The ballot can be completed after 3 days only"
        );

        ballots[ballotID].isCompleted = true;

        uint256 winnersCount = ballot.winnerIndexes.length;

        // Check if there are winners in a list.
        // 'winnersCount' equals 0 means that no votes were sent to the ballot.
        if (winnersCount > 0) {
            // Calculate the winnings total sum.
            uint256 winningsFund = (ballot.fund * (100 - fee)) / 100;

            ballots[ballotID].fund -= winningsFund;
            // Devide winnings total sum to the winners.
            uint256 proposalWinning = winningsFund / winnersCount;
            // Send winning to each winner.
            for (uint256 i = 0; i < winnersCount; i++) {
                address payable winner = payable(
                    ballot.proposals[ballot.winnerIndexes[i]]
                );
                winner.transfer(proposalWinning);
            }
        }
    }

    /**
     * @dev Sends the remaining amount from the commission to the owner.
     *
     * Requirements:
     *
     * - the ballot with a 'ballotID' is exist.
     * - the sender is the owner.
     * - the ballot is completed.
     */
    function withdrawFee(uint256 ballotID)
        public
        onlyOwner
        ballotExists(ballotID)
    {
        require(
            ballots[ballotID].isCompleted,
            "The ballot hasn't been completed yet"
        );

        payable(owner).transfer(ballots[ballotID].fund);

        ballots[ballotID].fund = 0;
    }

    /**
     * @dev Returns the ballot info.
     *
     * Requirements:
     *
     * - the ballot with a 'ballotID' is exist.
     */
    function getBallotInfo(uint256 ballotID)
        public
        view
        ballotExists(ballotID)
        returns (Ballot memory)
    {
        return ballots[ballotID];
    }

    /**
     * @dev Returns the voter's vote in the ballot.
     *
     * If there no voter with an 'voterAddr' function will return an zero address.
     *
     * Requirements:
     *
     * - the ballot with a 'ballotID' is exist.
     */
    function getVoterBallotVote(address voterAddr, uint256 ballotID)
        public
        view
        ballotExists(ballotID)
        returns (address)
    {
        return voted[voterAddr][ballotID];
    }

    /**
     * @dev Returns proposal's index in a ballot's proposals list.
     *
     * If proposal wasn't found function will return -1.
     */
    function findProposalIndex(uint256 ballotID, address proposalAddr)
        internal
        view
        returns (int256)
    {
        address[] memory proposals = ballots[ballotID].proposals;
        for (uint256 i = 0; i < proposals.length; i++) {
            if (proposals[i] == proposalAddr) {
                return int256(i);
            }
        }
        return -1;
    }
}
