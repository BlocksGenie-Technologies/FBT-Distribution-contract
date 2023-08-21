const hre = require("hardhat");
const axios = require('axios');
const ethers = require('ethers');

const FBT_TOKEN_CONTRACT_ADDRESS = '0x4727a02269943b225A7de9ef28496f36d454B983';
const ETHERSCAN_API_KEY = 'YAUIENIVR8F922FXDIHGFEHTN18UMB5IRH';
const URL = 'api.etherscan.io'

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

async function getTransactionHistory(address) {
  const apiUrl = `https://${URL}/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=asc&apikey=${ETHERSCAN_API_KEY}`;

  try {
      const response = await axios.get(apiUrl);
      return response.data.result;
  } catch (error) {
      console.error(`Error fetching transaction history for ${address}:`, error.message);
      return [];
  }
}
function calculateUserShare(tokenBalance, totalSupply, transactionCount) {
    // Implement your calculation logic based on the provided data
    // Return the calculated share
}
async function getTotalSupply() {
  try {
    const response = await axios.get(`https://${URL}/api?module=stats&action=tokensupply&contractaddress=${FBT_TOKEN_CONTRACT_ADDRESS}&apikey=${ETHERSCAN_API_KEY}`);
    return response.data.result;
  } catch (error) {
      console.error('Error fetching token holders:', error);
      return [];
  }
}

async function getBlockNumberForTimestamp(timestamp) {
  const apiUrl = `https://api.etherscan.io/api?module=block&action=getblocknobytime&timestamp=${timestamp}&closest=before&apikey=${ETHERSCAN_API_KEY}`;

  try {
      const response = await axios.get(apiUrl);
      const blockNumber = response.data.result;

      return blockNumber;
  } catch (error) {
      console.error('Error fetching block number:', error.message);
      return null;
  }
}

async function getTokenTransactions(userAddress, provider) {
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const twentyFourHoursAgoTimestamp = currentTimestamp - 24 * 60 * 60;

  const twentyFourHoursAgoBlockNumber  = await getBlockNumberForTimestamp(twentyFourHoursAgoTimestamp);
  const apiUrl = `https://api.etherscan.io/api?module=account&action=txlist&address=${userAddress}&startblock=${twentyFourHoursAgoBlockNumber}&endblock=latest&sort=asc&apikey=${ETHERSCAN_API_KEY}`;


  try {
    const response = await axios.get(apiUrl);
    const transactions = response.data.result;

    const transactionsWithin24Hours = transactions.filter(transaction => {
        return (
            transaction.to === contractAddress &&
            transaction.to.toLowerCase() === userAddress.toLowerCase()
        );
    });

    return transactionsWithin24Hours;
  } catch (error) {
      console.error('Error retrieving token transactions:', error.message);
      return [];
  }
  if (twentyFourHoursAgoBlockNumber === null) {
      console.error('Failed to retrieve block number for the timestamp.');
      return [];
  }

  const contract = new ethers.Contract(FBT_TOKEN_CONTRACT_ADDRESS, ['event Transfer(address indexed from, address indexed to, uint256 value)'], provider);
  

  const filter = contract.filters.Transfer(null, userAddress);

  console.log('twentyFourHoursAgoBlockNumber', twentyFourHoursAgoBlockNumber);

  const logs = await provider.getLogs({
    fromBlock: twentyFourHoursAgoBlockNumber,
    topics: filter.topics
  });

  //const events = logs.map(log => contract.interface.parseLog(log));

  return logs;
}

async function getTokenTransfersWithin24Hours(userAddress) {
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const twentyFourHoursAgoTimestamp = currentTimestamp - 24 * 60 * 60;

  const apiUrl = `https://api.etherscan.io/api?module=account&action=tokentx&address=${userAddress}&contractaddress=${FBT_TOKEN_CONTRACT_ADDRESS}&startblock=${twentyFourHoursAgoTimestamp}&endblock=latest&sort=asc&apikey=${ETHERSCAN_API_KEY}`;

  try {
      const response = await axios.get(apiUrl);
      const tokenTransfers = response.data.result;

      // Filter token transfers within the last 24 hours
      const tokenTransfersWithin24Hours = tokenTransfers.filter(transfer => {
          return (
              transfer.to.toLowerCase() === userAddress.toLowerCase()
          );
      });

      return tokenTransfersWithin24Hours;
  } catch (error) {
      console.error('Error retrieving token transfers:', error.message);
      return [];
  }
}

async function main() {
  //const [deployer] = await ethers.getSigners();
  const provider = new ethers.providers.JsonRpcProvider('https://eth.llamarpc.com');


   /* do {
        const holdersOnPage = await getTokenHolders(page);
        tokenHolders = tokenHolders.concat(holdersOnPage);
        page++;
    } while (tokenHolders.length % ITEMS_PER_PAGE === 0);*/

    const totalSupply = await getTotalSupply(); 

    const tokenHolders = await getTokenHolders();
    const chec = await getTokenTransactions('0x42B842e25C6778BCB803dbE1159f151c05C9CC97', provider);
    console.log('chec', chec);

    /*for (const holderAddress of tokenHolders) {
        const transactions = await getTransactionHistory(holderAddress);

        // Process transactions and calculate user's share
        // ...

        console.log(`Processed ${transactions.length} transactions for ${holderAddress}`);
        const
    }*/

    const check = tokenHolders.filter(holder => holder.TokenHolderAddress == '0x42B842e25C6778BCB803dbE1159f151c05C9CC97' );
    //console.log('tokenHolders', check)

   /* for (const holder of tokenHolders) {
        const balance = holder.balance;
        const transactionCount = await getTransactionCount(holder.account);
        const userShare = calculateUserShare(balance, totalSupply, transactionCount);
        
        // Perform revenue distribution or calculations as needed
        // ...

        console.log(`Holder: ${holder.account}`);
        console.log(`FBT Balance: ${balance}`);
        console.log(`Transaction Count: ${transactionCount}`);
        console.log(`User Share: ${userShare}`);
        console.log('---');
    }*/
    console.log("supply", totalSupply)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

