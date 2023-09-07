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
    revenueDistributor = await RevenueDistributor.deploy(mockToken.address, owner.address);
    await revenueDistributor.deployed();

    const distributedAmount = ethers.utils.parseEther("1");
    const lastDistributionTimestamp = await revenueDistributor.getLastDistributionTime();
    const revenuePeriod = 86400
    const hoursToSeconds = 3600;
    const totalSupply = await mockToken.totalSupply();

    await owner.sendTransaction({
      to: revenueDistributor.address,
      value: distributedAmount,
    });

    const currentTimestamp =  Math.floor(new Date().getTime() / 1000);
    const timestamp12HoursAgo = currentTimestamp - 12 * 60 * 60;
    const timestamp6HoursAgo = currentTimestamp - 6 * 60 * 60;
    const timestamp4HoursAgo = currentTimestamp - 4 * 60 * 60;
    const timestamp8HoursAgo = currentTimestamp - 8 * 60 * 60;
    const timestamp1HourAgo = currentTimestamp - 1 * 60 * 60;

    async function calculateShare(
      account,
      amounts,
      timestamps,
      initialBalance
    ) {
      console.log("account", account)
      console.log("amounts", amounts)
      console.log("timestamps", timestamps)
      console.log("initialBalance", initialBalance)
      if (amounts.length !== timestamps.length) {
        throw new Error("Amounts and timestamps arrays must have the same length");
      }
    
      const timeSinceLastDistribute = (Date.now() / 1000) - lastDistributionTimestamp;
      let additionalTokens = 0;
      let firstTxnTimestamp = 0;
      let lastTxnTimestamp = 0;
    
      for (let i = 0; i < amounts.length; i++) {
        additionalTokens += amounts[i];
        if (timestamps[i] < firstTxnTimestamp || firstTxnTimestamp === 0) {
          firstTxnTimestamp = timestamps[i];
        }
        if (timestamps[i] > lastTxnTimestamp) {
          lastTxnTimestamp = timestamps[i];
        }
      }
    
      const elapsedTimeTxn = lastTxnTimestamp - firstTxnTimestamp;
      const elapsedTimeInitial = firstTxnTimestamp === 0 ? revenuePeriod : firstTxnTimestamp - timeSinceLastDistribute;
      const elapsedTimeCurrent = lastTxnTimestamp === 0 ? 0 : (Date.now() / 1000) - lastTxnTimestamp;

      console.log("elapsedTimeTxn: " + elapsedTimeTxn)
      console.log("elapsedTimeInitial: " + elapsedTimeInitial)
      console.log("elapsedTimeCurrent: " + elapsedTimeCurrent)


      const accountBalance = await mockToken.balanceOf(account);
      const userHoldPercent = (accountBalance * 100) / totalSupply;
      const userAdditionalPercent = (additionalTokens * 100) / totalSupply;
      const userInitialPercent = (initialBalance * 100) / totalSupply;

      console.log("totalSupply: " + totalSupply)
      console.log("accountBalance: " + accountBalance)
      console.log("userHoldPercent: " + userHoldPercent)
      console.log("userAdditionalPercent: " + userAdditionalPercent)
      console.log("userInitialPercent: " + userInitialPercent)
    
      const initialBalanceShare = (userInitialPercent * elapsedTimeInitial) / (hoursToSeconds * 24);
      const additionalTokenShare = (userAdditionalPercent * elapsedTimeTxn) / (hoursToSeconds * 24);
      const currentBalanceShare = (userHoldPercent * elapsedTimeCurrent) / (hoursToSeconds * 24);
    
      const calculatedRewardPercent = initialBalanceShare + additionalTokenShare + currentBalanceShare;
      console.log("calculatedRewardPercent", calculatedRewardPercent);
      return (calculatedRewardPercent * distributedAmount) / 100;
    }
    
       

    const details = [
      {
        user: userA.address,
        reward: await calculateShare(
          userA.address,
          [],
          [],
          await mockToken.balanceOf(userA.address)
        ),
      },
      {
        user: userB.address,
        reward: await calculateShare(
          userB.address,
          [],
          [],
          await mockToken.balanceOf(userB.address)
        ),
      },
      {
        user: userC.address,
        reward: await calculateShare(
          userC.address,
          [],
          [],
          await mockToken.balanceOf(userC.address)
        ),
      }
    ]

    console.log("details", details)

    await revenueDistributor.distribute(details);
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