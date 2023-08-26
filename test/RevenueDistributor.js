const {ethers} = require("hardhat");
const {
  time,} = require("@nomicfoundation/hardhat-network-helpers");
  const { expect } = require("chai");

describe("RevenueDistributor",async function () {
  let revenueDistributor;
  let mockToken;
  let owner;
  let user;



  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    const MockToken = await ethers.getContractFactory("MOCK");
    mockToken = await MockToken.deploy();

    const initialTokenAmount = ethers.utils.parseUnits("1000");
    await mockToken.transfer(user.address, initialTokenAmount);

    const RevenueDistributor = await ethers.getContractFactory("RevenueDistributor");
    revenueDistributor = await RevenueDistributor.deploy(mockToken.address);
    await revenueDistributor.deployed();

    await owner.sendTransaction({
      to: revenueDistributor.address,
      value: ethers.utils.parseEther("1"),
    });
  });

  it("should allow a user to claim a reward after 24 hours", async function () {
    const ONE_DAY_IN_SECS = 24 * 60 * 60;
    await time.increaseTo(await time.latest() + ONE_DAY_IN_SECS);

    const initialBalance = await mockToken.balanceOf(user.address);

    await revenueDistributor.connect(user).claim([], [], initialBalance);

    const userClaimTimestamp = await revenueDistributor.getUserLastClaimTimestamp(user.address);
    const userPendingRewards = await revenueDistributor.pendingRewards(user.address, [], [],initialBalance);
    expect(userClaimTimestamp).to.equal(await time.latest());
    expect(userPendingRewards).to.equal(0);

  });
});