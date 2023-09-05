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

    /*await owner.sendTransaction({
      to: revenueDistributor.address,
      value: ethers.utils.parseEther("1"),
    });*/

    const currentTimestamp =  Math.floor(new Date().getTime() / 1000);
    const timestamp12HoursAgo = currentTimestamp - 12 * 60 * 60;
    const timestamp6HoursAgo = currentTimestamp - 6 * 60 * 60;
    const timestamp4HoursAgo = currentTimestamp - 4 * 60 * 60;
    const timestamp8HoursAgo = currentTimestamp - 8 * 60 * 60;
    const timestamp1HourAgo = currentTimestamp - 1 * 60 * 60;


    const details = [
      {
        user: userA.address,
        timestamp: [],
        amount: [],
        last24HourBalance: ethers.utils.parseUnits("1000")
      },
      {
        user: userB.address,
        timestamp: [],
        amount: [],
        last24HourBalance: ethers.utils.parseUnits("500")
      },
      {
        user: userC.address,
        timestamp: [],
        amount: [],
        last24HourBalance: ethers.utils.parseUnits("250")
      }
    ]

    await revenueDistributor.distribute(details,{from: owner.address, value: ethers.utils.parseEther('1')});
  });

  it("should allow a user to claim a reward after 24 hours", async function () {
    const ONE_DAY_IN_SECS = 24 * 60 * 60;
    await time.increaseTo(await time.latest() + ONE_DAY_IN_SECS);

    let userAinitialBalance = await mockToken.balanceOf(userA.address);
    let userAPendingRewards = await revenueDistributor.pendingRewards(userA.address);
    let userBinitialBalance = await mockToken.balanceOf(userB.address);
    let userBPendingRewards = await revenueDistributor.pendingRewards(userB.address);
    let userCinitialBalance = await mockToken.balanceOf(userC.address);
    let userCPendingRewards = await revenueDistributor.pendingRewards(userC.address);

    console.log({
      userAinitialBalance: ethers.utils.formatEther(userAinitialBalance.toString()),
      userAPendingRewards: ethers.utils.formatEther(userAPendingRewards.toString()),
      userBinitialBalance: ethers.utils.formatEther(userBinitialBalance.toString()),
      userBPendingRewards: ethers.utils.formatEther(userBPendingRewards.toString()),
      userCinitialBalance: ethers.utils.formatEther(userCinitialBalance.toString()),
      userCPendingRewards: ethers.utils.formatEther(userCPendingRewards.toString()),
    });

    await revenueDistributor.connect(userA).claim();
    userAPendingRewards = await revenueDistributor.pendingRewards(userA.address);
    expect(userAPendingRewards).to.equal(0);


    await owner.sendTransaction({
      to: revenueDistributor.address,
      value: ethers.utils.parseEther("1"),
    });
    await time.increaseTo(await time.latest() + ONE_DAY_IN_SECS);
    console.log("24 hours later")

    userAinitialBalance = await mockToken.balanceOf(userA.address);
    userAPendingRewards = await revenueDistributor.pendingRewards(userA.address);
    userBinitialBalance = await mockToken.balanceOf(userB.address);
    userBPendingRewards = await revenueDistributor.pendingRewards(userB.address);
    userCinitialBalance = await mockToken.balanceOf(userC.address);
    userCPendingRewards = await revenueDistributor.pendingRewards(userC.address);

    console.log({
      userAinitialBalance: ethers.utils.formatEther(userAinitialBalance.toString()),
      userAPendingRewards: ethers.utils.formatEther(userAPendingRewards.toString()),
      userBinitialBalance: ethers.utils.formatEther(userBinitialBalance.toString()),
      userBPendingRewards: ethers.utils.formatEther(userBPendingRewards.toString()),
      userCinitialBalance: ethers.utils.formatEther(userCinitialBalance.toString()),
      userCPendingRewards: ethers.utils.formatEther(userCPendingRewards.toString()),
    });

  });
});