const hre = require("hardhat");
const axios = require('axios');
const ethers = require('ethers');
const fs = require('fs');
const RevenueFactory = require("../artifacts/contracts/RevenueDistributor.sol/RevenueDistributor.json")
const tokenFactory = require("../artifacts/contracts/MOCK.sol/MOCK.json")

const FBT_TOKEN_CONTRACT_ADDRESS = '0x4727a02269943b225A7de9ef28496f36d454B983';
const ETHERSCAN_API_KEY = 'YAUIENIVR8F922FXDIHGFEHTN18UMB5IRH';
const REVENUE_DISTRIBUTOR = "0xA172E148250863070A89d626f85a9cc856f85043"
const URL = 'api.etherscan.io'
const provider = new ethers.providers.JsonRpcProvider('https://endpoints.omniatech.io/v1/eth/sepolia/public');
const provider1 = new ethers.providers.JsonRpcProvider('https://eth.llamarpc.com');
const wallet = new ethers.Wallet("", provider);
const wallet1 = new ethers.Wallet("", provider1);
const revenueContractInstance = new ethers.Contract(REVENUE_DISTRIBUTOR, RevenueFactory.abi, wallet)
const FbtContractInstance = new ethers.Contract(FBT_TOKEN_CONTRACT_ADDRESS, tokenFactory.abi, wallet1)

async function getTokenHolders() {
  const apiUrl = `https://${URL}/api?module=token&action=tokenholderlist&contractaddress=${FBT_TOKEN_CONTRACT_ADDRESS}&apikey=${ETHERSCAN_API_KEY}`;

  try {
      const response = await axios.get(apiUrl);
      const tokenHolders = response.data.result;

      return tokenHolders;
  } catch (error) {
      console.error('Error fetching token holders:', error.message);
      return [];
  }
}


async function getBlockNumberForTimestamp(timestamp){
  const apiUrl = `https://${URL}/api?module=block&action=getblocknobytime&timestamp=${timestamp}&closest=before&apikey=${ETHERSCAN_API_KEY}`;
  let blockNumber = -1;

  try {
      const response = await axios.get(apiUrl);
      blockNumber = response.data.result;
  } catch (error) {
      console.error('Error fetching block number:', error.message);
  }
  return blockNumber;
}


async function getTokenTransactions(userAddress){
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const twentyFourHoursAgoTimestamp = currentTimestamp - 24 * 60 * 60;

  const twentyFourHoursAgoBlockNumber = await getBlockNumberForTimestamp(twentyFourHoursAgoTimestamp);
  const apiUrl = `https://${URL}/api?module=account&action=tokentx&address=${userAddress}&contractaddress=${FBT_TOKEN_CONTRACT_ADDRESS}&startblock=${twentyFourHoursAgoBlockNumber}&endblock=latest&sort=asc&apikey=${ETHERSCAN_API_KEY}`;
  let transactionsWithin24Hours;
  let transactions;

  try {
      const response = await axios.get(apiUrl);
      transactions = response.data.result;

      transactionsWithin24Hours = transactions.filter(transaction =>
          transaction.to.toLocaleLowerCase() === userAddress.toLocaleLowerCase() && 
          transaction.to.toLocaleUpperCase() !== FBT_TOKEN_CONTRACT_ADDRESS
      );

      return transactionsWithin24Hours;
  } catch (error) {
      console.error('Error retrieving token transactions:', error.message);
  }
  return transactionsWithin24Hours;
}


async function getUserTokenBalanceAtBlockV2(rpc, tokenAddres, userAddress, blockNumber){

  let balance = ethers.BigNumber.from(0);

  // ABI
  let abi = [
      'function balanceOf(address account)'
  ];

  // Create function call data -- eth_call
  let iface = new ethers.utils.Interface(abi)
  let data = iface.encodeFunctionData("balanceOf", [userAddress]);
  const params = [{
      to: tokenAddres,
      data: data,
  }, Number(blockNumber)];

  try {
      const response = await axios.post(rpc, {
          jsonrpc: "2.0",
          id: 1,
          method: "eth_call",
          params
      }, {
          headers: {
              'Content-Type': 'application/json',
          },
      })

      let result = response.data.result;
      if (result === '0x') {
          result = '0x0'
      }
      balance = ethers.BigNumber.from(result)

  } catch (error) {
      console.error(error)
  }

  return balance;
}


async function calculateShare(
  account,
  amounts,
  timestamps,
  initialBalance,
  distributedAmount
) {
  if (amounts.length !== timestamps.length) {
      throw new Error("Amounts and timestamps arrays must have the same length");
  }

  

  const lastDistributionTimestamp = await revenueContractInstance.getLastDistributionTime();
  const totalSupply = await FbtContractInstance.totalSupply();
  const revenuePeriod = 86400
  const hoursToSeconds = 3600

  const timeSinceLastDistribute = Number(lastDistributionTimestamp);
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
  const elapsedTimeInitial = firstTxnTimestamp === 0 ? revenuePeriod :  firstTxnTimestamp > timeSinceLastDistribute 
  ? firstTxnTimestamp - timeSinceLastDistribute : timeSinceLastDistribute - firstTxnTimestamp;
  const elapsedTimeCurrent = lastTxnTimestamp === 0 ? 0 : (Date.now() / 1000) - lastTxnTimestamp;


  const accountBalance = await FbtContractInstance.balanceOf(account);
  const accountBalanceFormatted = Number(ethers.utils.formatEther(accountBalance))
  const totalSupplyFormatted = Number(ethers.utils.formatEther(totalSupply))
  let userHoldPercent = (accountBalanceFormatted * 100) / totalSupplyFormatted;
  let userAdditionalPercent = (additionalTokens * 100) / totalSupplyFormatted;
  let userInitialPercent = (initialBalance * 100) / totalSupplyFormatted;
  userHoldPercent = userHoldPercent > 2 ? 2 : userHoldPercent
  userAdditionalPercent = userAdditionalPercent > 2 ? 2 : userAdditionalPercent
  userInitialPercent = userInitialPercent > 2 ? 2 : userInitialPercent

  const initialBalanceShare = (userInitialPercent * elapsedTimeInitial) / (hoursToSeconds * 24);
  const additionalTokenShare = (userAdditionalPercent * elapsedTimeTxn) / (hoursToSeconds * 24);
  const currentBalanceShare = (userHoldPercent * elapsedTimeCurrent) / (hoursToSeconds * 24);

  const calculatedRewardPercent = initialBalanceShare + additionalTokenShare + currentBalanceShare;
  
  return (calculatedRewardPercent * distributedAmount) / 100;
}


async function getUserDetails(){
  const rpc = "https://eth.llamarpc.com"
  const provider = new ethers.providers.JsonRpcProvider('https://eth.llamarpc.com');
  let usersDetails = [];

    const twentyFourHoursAgo = Math.floor(Date.now() / 1000) - 86400
    const tokenHolders = await getTokenHolders();
    for (let i = 200; i < tokenHolders.length; i++) {
      const tokenHolder = tokenHolders[i];
      const userTokenTxs = await getTokenTransactions(tokenHolder.TokenHolderAddress);
      //console.log("userTokenTxs", tokenHolder.TokenHolderAddress)
      const blockNumber = await getBlockNumberForTimestamp(twentyFourHoursAgo);
      //console.log({ blockNumber })
      const txValues = userTokenTxs.map((tx) => Number(ethers.utils.formatEther(tx.value)));
      //console.log({ txValues })
      const txTimestamps = userTokenTxs.map((tx) => Number(tx.timeStamp));
      //console.log({ txTimestamps })
      const initialBalance = await getUserTokenBalanceAtBlockV2(rpc, FBT_TOKEN_CONTRACT_ADDRESS, tokenHolder.TokenHolderAddress, blockNumber)
      //console.log({ initialBalance })
      const getUserShare = await calculateShare(
        tokenHolder.TokenHolderAddress,
        txValues,
        txTimestamps,
        Number(ethers.utils.formatEther(initialBalance)),
        Number(ethers.BigNumber.from("3"))
      )
      const reward = Math.floor(getUserShare * 10E18).toLocaleString('fullwide', { useGrouping: false })
      //console.log({reward})

      const details = {
        user: tokenHolder.TokenHolderAddress,
        reward: ethers.BigNumber.from(reward),
      }
      console.log(details)

      usersDetails.push(details);

    }
    const currentTimestamp = Math.floor(Date.now() / 1000);

    fs.writeFileSync(`./data/${currentTimestamp}.json`, JSON.stringify(usersDetails));

    console.log(usersDetails)

    return usersDetails;
}


function sliceIntoChunks(arr, chunkSize){
  const res= [];
  for (let i = 0; i < arr.length; i += chunkSize) {
      const chunk = arr.slice(i, i + chunkSize);
      res.push(chunk);
  }
  return res;
}


async function main() {
  //const [deployer] = await ethers.getSigners();
  let usersDetails = await getUserDetails();
  

  const slices = sliceIntoChunks(usersDetails, 100);

  for (let i = 0; i < slices.length; i++) {
      const slice = slices[i];
      const tx = await revenueContractInstance.distribute(slice);
      await tx.wait();
      console.log("wait 1 minute")
      //await sleep(60 * 1000) // 1 minute
      console.log({ txHash: tx.hash })
  }

  usersDetails = [];
  
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

