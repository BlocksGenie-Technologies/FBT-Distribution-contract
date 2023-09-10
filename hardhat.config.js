require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.19",
  settings: {
    optimizer: {
      enabled: true,
      runs: 1,
    },
    evmVersion: 'paris',
  },
  networks: {
    goerli: {
      url: "https://ethereum-goerli.publicnode.com",
      accounts: ['0x0ff30305ccab0beb6cb2a0e39652145efab725cbc0d09fe2a217bab4b00cfbef'],
    }
  }
};
