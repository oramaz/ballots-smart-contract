const { expect } = require("chai");
const { ethers } = require("hardhat");

const votePayable = {
  value: ethers.utils.parseEther("0.01"),
};
const threeDays = 3 * 24 * 60 * 60;

// Convert the time in EVM to 3 days.
const increaseBlockTimeOn3Days = async () => {
  ethers.provider.send("evm_increaseTime", [threeDays + 3600]);
  ethers.provider.send("evm_mine");
};

describe("Ballots contract", function () {
  let Contract;
  let contract;
  let owner;
  let addr1, addr2, addr3, addr4, addr5;
  let prop1, prop2, prop3, prop4, prop5;
  let props;

  beforeEach(async function () {
    Contract = await ethers.getContractFactory("Ballots");
    [
      owner,
      prop1,
      prop2,
      prop3,
      prop4,
      prop5,
      addr1,
      addr2,
      addr3,
      addr4,
      addr5,
    ] = await ethers.getSigners();
    props = [
      prop1.address,
      prop2.address,
      prop3.address,
      prop4.address,
      prop5.address,
    ];
    contract = await Contract.deploy();
  });

  /*
   * Deployment subsection
   */
  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await contract.owner()).to.equal(owner.address);
    });
  });

  /*
   * Ballot creating subsection
   */
  describe("Ballot creating", function () {
    it("Should be reverted with a onlyOwner reason", async function () {
      await expect(
        contract.connect(addr1).createBallot(props)
      ).to.be.revertedWith("The sender doesn't have owner rights");
    });

    it("Should be reverted with a proposals quantity reason", async function () {
      props = [];

      await expect(
        contract.connect(owner).createBallot(props)
      ).to.be.revertedWith("A new ballot should contain >= 2 proposals");
    });

    it("Should create new 2 ballots", async function () {
      await contract.connect(owner).createBallot(props);

      const b0 = await contract.ballots(0);
      const b1 = await contract.ballots(1);

      expect(b0.created > 0 && b1.created == 0).to.be.true;
    });
  });

  /*
   * Ballot completing subsection
   */
  describe("Ballot completing", function () {
    it("Should be reverted with a ballot unexistence reason", async function () {
      await expect(
        contract.connect(addr1).completeBallot(0)
      ).to.be.revertedWith("The ballot doesn't exist");
    });

    it("Should be reverted with a ballot duration reason", async function () {
      await contract.connect(owner).createBallot(props);

      await expect(
        contract.connect(addr1).completeBallot(0)
      ).to.be.revertedWith("The ballot can be completed after 3 days only");
    });

    it("Should complete the ballot and transfer a prize (0.009 ETH) to a winner", async function () {
      await contract.connect(owner).createBallot(props);
      await contract.connect(addr1).vote(0, prop2.address, votePayable);
      await increaseBlockTimeOn3Days();
      await contract.connect(addr1).completeBallot(0);

      const ballot = await contract.ballots(0);

      expect(ballot.isCompleted).to.be.true;
      expect(ballot.fund).to.equal(ethers.utils.parseEther("0.001"));
      expect(await ethers.provider.getBalance(prop2.address)).to.equal(
        ethers.utils.parseEther("10000.009")
      );
    });

    it("Should complete the ballot and transfer prizes (0.027 ETH each) to 2 winners", async function () {
      await contract.connect(owner).createBallot(props);
      await contract.connect(addr1).vote(0, prop1.address, votePayable);
      await contract.connect(addr2).vote(0, prop3.address, votePayable);
      await contract.connect(addr3).vote(0, prop4.address, votePayable);
      await contract.connect(addr4).vote(0, prop4.address, votePayable);
      await contract.connect(addr5).vote(0, prop5.address, votePayable);
      await contract.connect(owner).vote(0, prop5.address, votePayable);

      await increaseBlockTimeOn3Days();
      await contract.connect(addr1).completeBallot(0);

      const ballot = await contract.ballots(0);

      expect(ballot.isCompleted).to.be.true;
      expect(ballot.fund).to.equal(ethers.utils.parseEther("0.006"));
      expect(await ethers.provider.getBalance(prop5.address)).to.equal(
        ethers.utils.parseEther("10000.027")
      );
      expect(await ethers.provider.getBalance(prop4.address)).to.equal(
        ethers.utils.parseEther("10000.027")
      );
      expect(await ethers.provider.getBalance(prop3.address)).to.equal(
        ethers.utils.parseEther("10000")
      );
    });

    it("Should complete the ballot with a zero votes", async function () {
      await contract.connect(owner).createBallot(props);

      await increaseBlockTimeOn3Days();
      await contract.connect(addr1).completeBallot(0);

      const ballot = await contract.ballots(0);

      expect(ballot.isCompleted).to.be.true;

      expect(ballot.fund).to.equal(ethers.utils.parseEther("0"));

      expect(await ethers.provider.getBalance(contract.address)).to.equal(
        ethers.utils.parseEther("0")
      );
    });
  });

  /*
   * Voting subsection
   */
  describe("Voting", function () {
    it("Should be reverted with a ballot unexistence reason", async function () {
      await contract.connect(owner).createBallot(props);

      await expect(
        contract.connect(addr1).vote(1, prop1.address, votePayable)
      ).to.revertedWith("The ballot doesn't exist");
    });

    it("Should be reverted with a completed ballot reason", async function () {
      await contract.connect(owner).createBallot(props);
      await increaseBlockTimeOn3Days();
      await contract.connect(addr1).completeBallot(0);

      await expect(
        contract.connect(addr2).vote(0, prop2.address, votePayable)
      ).to.be.revertedWith("The ballot has already been completed");
    });

    it("Should be reverted with a deposit in 0.01 ETH unexistence reason", async function () {
      await contract.connect(owner).createBallot(props);

      await expect(
        contract.connect(addr1).vote(0, prop1.address)
      ).to.be.revertedWith("Need to deposit 0.01 ETH to vote");
    });

    it("Should be reverted with a excessive voting reason", async function () {
      await contract.connect(owner).createBallot(props);

      await contract.connect(addr1).vote(0, prop1.address, votePayable);

      await expect(
        contract.connect(addr1).vote(0, prop1.address, votePayable)
      ).to.be.revertedWith("The voter has already voted");
    });

    it("Should be reverted with a wrong proposal reason", async function () {
      props = [prop1.address, prop2.address];

      await contract.connect(owner).createBallot(props);

      await expect(
        contract.connect(addr1).vote(0, prop3.address, votePayable)
      ).to.be.revertedWith("There no such proposal in the ballot");
    });

    it("Should increase proposal's score and change ballot's fund to 0.02 ETH", async function () {
      await contract.connect(owner).createBallot(props);

      await contract.connect(addr1).vote(0, prop1.address, votePayable);

      expect(await contract.voted(addr1.address, 0)).not.to.be.equal(
        ethers.constants.AddressZero
      );

      expect((await contract.ballots(0)).fund).to.equal(
        ethers.utils.parseEther("0.01")
      );
      expect(await ethers.provider.getBalance(contract.address)).to.equal(
        ethers.utils.parseEther("0.01")
      );
    });

    it("Should increase 2 ballots' proposals' score", async function () {
      await contract.connect(owner).createBallot(props);
      await contract.connect(owner).createBallot(props);

      await contract.connect(addr1).vote(0, prop1.address, votePayable);
      await contract.connect(addr1).vote(1, prop2.address, votePayable);

      expect(await contract.voted(addr1.address, 0)).not.to.be.equal(
        ethers.constants.AddressZero
      );
      expect(await contract.voted(addr1.address, 1)).not.to.be.equal(
        ethers.constants.AddressZero
      );

      expect(await ethers.provider.getBalance(contract.address)).to.equal(
        ethers.utils.parseEther("0.02")
      );
    });
  });

  /*
   * Withdrawing fee subsection
   */
  describe("Withdrawing fee", function () {
    it("Should be reverted with a onlyOwner reason", async function () {
      await contract.connect(owner).createBallot(props);

      await expect(contract.connect(addr1).withdrawFee(0)).to.be.revertedWith(
        "The sender doesn't have owner rights"
      );
    });

    it("Should be reverted with an active ballot reason", async function () {
      await contract.connect(owner).createBallot(props);

      await expect(contract.connect(owner).withdrawFee(0)).to.be.revertedWith(
        "The ballot hasn't been completed yet"
      );
    });

    it("Should be reverted with a ballot unexistence reason", async function () {
      await expect(contract.connect(owner).withdrawFee(0)).to.be.revertedWith(
        "The ballot doesn't exist"
      );
    });

    it("Should withdraw the ballot's fee", async function () {
      await contract.connect(owner).createBallot(props);

      await contract.connect(addr1).vote(0, prop2.address, votePayable);
      await increaseBlockTimeOn3Days();
      await contract.connect(owner).completeBallot(0);

      await contract.connect(owner).withdrawFee(0);

      expect((await contract.ballots(0)).fund).to.equal(0);
      expect(await ethers.provider.getBalance(contract.address)).to.equal(0);
    });
  });

  /*
   * Getting ballot's info subsection
   */
  describe("Getting ballot's info", function () {
    it("Should be reverted with a ballot unexistence reason", async function () {
      await expect(contract.getBallotInfo(0)).to.be.revertedWith(
        "The ballot doesn't exist"
      );
    });
    it("Should get the ballot's proposals", async function () {
      props = [prop1.address, prop2.address];
      await contract.connect(owner).createBallot(props);

      const proposals = (await contract.getBallotInfo(0)).proposals;

      expect(proposals[0]).to.equal(props[0]);
      expect(proposals[1]).to.equal(props[1]);
    });
  });

  /*
   * Getting voter's ballot vote info subsection
   */
  describe("Getting voter's ballot vote info", function () {
    it("Should be reverted with a ballot unexistence reason", async function () {
      await expect(
        contract.getVoterBallotVote(addr1.address, 0)
      ).to.be.revertedWith("The ballot doesn't exist");
    });
    it("Should get the voters's ballot vote (address)", async function () {
      await contract.connect(owner).createBallot(props);
      await contract.connect(addr1).vote(0, prop1.address, votePayable);

      expect(await contract.getVoterBallotVote(addr1.address, 0)).to.equal(
        prop1.address
      );
      expect(await contract.getVoterBallotVote(addr2.address, 0)).to.equal(
        ethers.constants.AddressZero
      );
    });
  });
});
