// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "hardhat/console.sol";

contract RevenueDistributor is Ownable, ReentrancyGuard {
    mapping(address => uint256) public userClaimTimestamp;

    IERC20 public token;
    uint256 public revenuePeriod;

    constructor(address _tokenAddress) {
        require(_tokenAddress != address(0), "Invalid tokenAddress");
        token = IERC20(_tokenAddress);
        revenuePeriod = 1 days;
    }

    receive() external payable {}


    function setTokenAddress(address _tokenAddress) external onlyOwner {
        require(_tokenAddress != address(0), "Invalid tokenAddress");
        token = IERC20(_tokenAddress);
    }

    function getUserLastClaimTimestamp(address _account) external view returns(uint256){
        return userClaimTimestamp[_account];
    }

    function claim(
        uint256[] memory transactionAmounts,
        uint256[] memory transactionTimestamps,
        uint256 userInitialBalance
    ) external nonReentrant {
        uint256 userClaimAmount = pendingRewards(
            msg.sender,
            transactionAmounts,
            transactionTimestamps,
            userInitialBalance
        );
        require(userClaimAmount > 0);
        require(address(this).balance >= userClaimAmount);

        userClaimTimestamp[msg.sender] = block.timestamp;

        (bool sent, ) = payable(msg.sender).call{value: userClaimAmount}("");
        require(sent, "Failed to send Ether");
    }

    /*
    Gets distributed to all holders of fbt tokens depending on how much fbt tokens they hold

    The more they hold the more rewards they get
    */

    /**
     * @dev Calculate pending rewards
     * @param account user address
     * @param amounts array of user additional amounts in last 24hr
     * @param timestamps array of timestamps in last 24hr transactions
     * @param initialBalance user balance in last 24hr
     * @return Peding rewards
     */
    function pendingRewards(
        address account,
        uint256[] memory amounts,
        uint256[] memory timestamps,
        uint256 initialBalance
    ) public view returns (uint256) {
        require(amounts.length == timestamps.length);

        uint256 timeSinceLastClaim = block.timestamp - userClaimTimestamp[account];
        if (userClaimTimestamp[account] != 0 && timeSinceLastClaim < revenuePeriod) {
            return 0;
        }

        uint256 additionalTokens;
        uint256 firstTxnTimestamp = 0;
        uint256 lastTxnTimestamp = 0;

        for (uint256 i = 0; i < amounts.length; i++) {
            additionalTokens += amounts[i];
            if (timestamps[i] < firstTxnTimestamp) {
                firstTxnTimestamp = timestamps[i];
            }
            if (timestamps[i] > lastTxnTimestamp) {
                lastTxnTimestamp = timestamps[i];
            }
        }

        uint256 elapsedTimeTxn = lastTxnTimestamp - firstTxnTimestamp;
        uint256 elapsedTimeInitial = firstTxnTimestamp == 0 ? userClaimTimestamp[account] == 0 ? 86400 : timeSinceLastClaim
        : userClaimTimestamp[account] == 0 ? firstTxnTimestamp - block.timestamp - revenuePeriod : firstTxnTimestamp - userClaimTimestamp[account];

        uint256 elapsedTimeCurrent = lastTxnTimestamp == 0 ? 0 :  block.timestamp - lastTxnTimestamp;

        uint256 reward = _calculateShare(
            account,
            elapsedTimeInitial,
            elapsedTimeTxn,
            elapsedTimeCurrent,
            initialBalance,
            additionalTokens
        );

        return reward;
    }



    /* function to calculate the share of the caller address, summation of percentage of the last 24hrs balance, 
    addtional amounts gotten from transactions within 24hrs and the user current balance multiple by their respective elapsed timestamps */
    function _calculateShare(
        address _account,
        uint256 _elapsedTimeInitial,
        uint256 _elapsedTimeTxn,
        uint256 _elapsedTimeCurrent,
        uint256 _initialBalance,
        uint256 _additionalTokens
    ) internal view returns (uint256) {
        uint256 hoursToSeconds = 3600;
        uint256 accountBalance = token.balanceOf(_account);
        uint256 totalSupply = token.totalSupply();

        uint256 userHoldPercent = (accountBalance * 10000) / totalSupply;
        uint256 userAdditionalPercent = (_additionalTokens * 10000) / totalSupply;
        uint256 userInitialPercent = (_initialBalance * 10000) / totalSupply;

        uint256 initialBalanceShare = (userInitialPercent * _elapsedTimeInitial) / (hoursToSeconds * 24);
        uint256 additionalTokenShare = (userAdditionalPercent * _elapsedTimeTxn) / (hoursToSeconds * 24);
        uint256 currentBalanceShare = (userHoldPercent * _elapsedTimeCurrent) / (hoursToSeconds * 24);

        uint256 userHoldPercentInEth = (currentBalanceShare * address(this).balance) / 10000;
        uint256 userAdditionalPercentInEth = (additionalTokenShare * address(this).balance) / 10000;
        uint256 userInitialPercentInEth = (initialBalanceShare * address(this).balance) / 10000;

        return userHoldPercentInEth + userInitialPercentInEth + userAdditionalPercentInEth;
    }

    
}
