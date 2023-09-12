const { ethers } = require("hardhat");
const {time} = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const colors = require('colors/safe');

describe("RevenueDistributor", async function () {
  let revenueDistributor;
  let mockToken;
  let owner;
  let userA;
  let userB;
  let userC;


  it("2. Deploy Contract", async () => {
    signers = await ethers.getSigners();
    owner = signers[0];
    userA = signers[1];
    userB = signers[2];
    userC = signers[3];
    console.log(`${colors.cyan('Deployer Address')}: ${colors.yellow(owner?.address)}`)


    
    const MockToken = await ethers.getContractFactory("MOCK");
    mockToken = await MockToken.deploy();

    
    await mockToken.transfer(userA.address, ethers.utils.parseUnits("1500"));
    await mockToken.transfer(userB.address, ethers.utils.parseUnits("1000"));
    await mockToken.transfer(userC.address, ethers.utils.parseUnits("500"));
    expect(await mockToken.balanceOf(userA.address)).to.equal(ethers.utils.parseUnits("1500"));
    expect(await mockToken.balanceOf(userB.address)).to.equal(ethers.utils.parseUnits("1000"));
    expect(await mockToken.balanceOf(userC.address)).to.equal(ethers.utils.parseUnits("500"));

    const RevenueDistributor = await ethers.getContractFactory("RevenueDistributor");
    revenueDistributor = await RevenueDistributor.deploy(owner.address);
    await revenueDistributor.deployed();
  })
  
  it("should allow a user to claim a reward after 24 hours", async function () {
    const distributedAmount = ethers.utils.parseUnits("3");
    await owner.sendTransaction({
      to: revenueDistributor.address,
      value: distributedAmount
    });
    const contractEthBalance = await ethers.provider.getBalance(revenueDistributor.address);
    console.log("contractEthBalance", contractEthBalance);
    //expect(contractEthBalance).to.equal(ethers.utils.parseUnits("3"));


    
    const ONE_DAY_IN_SECS = 24 * 60 * 60;
    await time.increaseTo(await time.latest() + ONE_DAY_IN_SECS);


    const usersBalances = [
      {
        user: userA.address,
        balance: await mockToken.balanceOf(userA.address)
      },
      {
        user: userB.address,
        balance: await mockToken.balanceOf(userB.address)
      },
      {
        user: userC.address,
        balance: await mockToken.balanceOf(userC.address)
      },
    ]

    const details = [
    ]

    const allHoldersTokenBalance = usersBalances.map(user => user.balance).reduce((a, b) => a.add(b), ethers.BigNumber.from(0)); 
    console.log("allHoldersTokenBalance", allHoldersTokenBalance.toString())

    usersBalances.forEach(user => {
      const holderBalance = ethers.BigNumber.from(user.balance)
      const holderBalancePercent = ethers.utils.formatEther(ethers.utils.parseEther(holderBalance.toString()).div(allHoldersTokenBalance).mul(100).toString())
      const holderRewards = holderBalance.mul(distributedAmount).div(allHoldersTokenBalance)
      console.log({
        user: user.user,
        balance: ethers.utils.formatEther(user.balance.toString()),
        holderBalancePercent,
        holderRewards: ethers.utils.formatEther(holderRewards.toString())
      })
      details.push({
        user: user.user,
        reward: holderRewards
      })
    })

    console.log("details", details)

    await revenueDistributor.distribute(details);

    const userARewards = await revenueDistributor.pendingRewards(userA.address);
    const userBRewards = await revenueDistributor.pendingRewards(userB.address);
    const userCRewards = await revenueDistributor.pendingRewards(userC.address);

    console.log({
      userARewards: ethers.utils.formatEther(userARewards.toString()),
      userBRewards: ethers.utils.formatEther(userBRewards.toString()),
      userCRewards: ethers.utils.formatEther(userCRewards.toString()),
    })
  });
  
});