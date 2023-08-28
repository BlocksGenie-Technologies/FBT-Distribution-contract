const { ethers } = require("hardhat");
const {
  time, } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

describe("RevenueDistributor", async function () {
  let revenueDistributor;
  let mockToken;
  let owner;
  let userA;
  let userB;
  let userC;


  beforeEach(async function () {
    [owner, userA, userB, userC] = await ethers.getSigners();

    const MockToken = await ethers.getContractFactory("MOCK");
    mockToken = await MockToken.deploy();

    await mockToken.transfer(userA.address, ethers.utils.parseUnits("1000"));
    await mockToken.transfer(userB.address, ethers.utils.parseUnits("500"));
    await mockToken.transfer(userC.address, ethers.utils.parseUnits("250"));

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

    let userAinitialBalance = await mockToken.balanceOf(userA.address);
    let userAClaimTimestamp = await revenueDistributor.getUserLastClaimTimestamp(userA.address);
    let userAPendingRewards = await revenueDistributor.pendingRewards(userA.address, [], [], userAinitialBalance);
    let userBinitialBalance = await mockToken.balanceOf(userB.address);
    let userBClaimTimestamp = await revenueDistributor.getUserLastClaimTimestamp(userB.address);
    let userBPendingRewards = await revenueDistributor.pendingRewards(userB.address, [], [], userBinitialBalance);
    let userCinitialBalance = await mockToken.balanceOf(userC.address);
    let userCClaimTimestamp = await revenueDistributor.getUserLastClaimTimestamp(userC.address);
    let userCPendingRewards = await revenueDistributor.pendingRewards(userC.address, [], [], userCinitialBalance);

    console.log({
      userAinitialBalance: ethers.utils.formatEther(userAinitialBalance.toString()),
      userAClaimTimestamp: ethers.utils.formatEther(userAClaimTimestamp.toString()),
      userAPendingRewards: ethers.utils.formatEther(userAPendingRewards.toString()),
      userBinitialBalance: ethers.utils.formatEther(userBinitialBalance.toString()),
      userBClaimTimestamp: ethers.utils.formatEther(userBClaimTimestamp.toString()),
      userBPendingRewards: ethers.utils.formatEther(userBPendingRewards.toString()),
      userCinitialBalance: ethers.utils.formatEther(userCinitialBalance.toString()),
      userCClaimTimestamp: ethers.utils.formatEther(userCClaimTimestamp.toString()),
      userCPendingRewards: ethers.utils.formatEther(userCPendingRewards.toString()),
    });

    await revenueDistributor.connect(userA).claim([], [], userAinitialBalance);
    userAClaimTimestamp = await revenueDistributor.getUserLastClaimTimestamp(userA.address);
    userAPendingRewards = await revenueDistributor.pendingRewards(userA.address, [], [], userAinitialBalance);
    expect(userAClaimTimestamp).to.equal(await time.latest());
    expect(userAPendingRewards).to.equal(0);

    await time.increaseTo(await time.latest() + ONE_DAY_IN_SECS);
    console.log("24 hours later")

    userAinitialBalance = await mockToken.balanceOf(userA.address);
    userAClaimTimestamp = await revenueDistributor.getUserLastClaimTimestamp(userA.address);
    userAPendingRewards = await revenueDistributor.pendingRewards(userA.address, [], [], userAinitialBalance);
    userBinitialBalance = await mockToken.balanceOf(userB.address);
    userBClaimTimestamp = await revenueDistributor.getUserLastClaimTimestamp(userB.address);
    userBPendingRewards = await revenueDistributor.pendingRewards(userB.address, [], [], userBinitialBalance);
    userCinitialBalance = await mockToken.balanceOf(userC.address);
    userCClaimTimestamp = await revenueDistributor.getUserLastClaimTimestamp(userC.address);
    userCPendingRewards = await revenueDistributor.pendingRewards(userC.address, [], [], userCinitialBalance);

    console.log({
      userAinitialBalance: ethers.utils.formatEther(userAinitialBalance.toString()),
      userAClaimTimestamp: userAClaimTimestamp.toString(),
      userAPendingRewards: ethers.utils.formatEther(userAPendingRewards.toString()),
      userBinitialBalance: ethers.utils.formatEther(userBinitialBalance.toString()),
      userBClaimTimestamp: userBClaimTimestamp.toString(),
      userBPendingRewards: ethers.utils.formatEther(userBPendingRewards.toString()),
      userCinitialBalance: ethers.utils.formatEther(userCinitialBalance.toString()),
      userCClaimTimestamp: userCClaimTimestamp.toString(),
      userCPendingRewards: ethers.utils.formatEther(userCPendingRewards.toString()),
    });

  });
});