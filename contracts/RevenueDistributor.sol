// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "hardhat/console.sol";

contract RevenueDistributor is Ownable, ReentrancyGuard {
    using SafeMath for uint;
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

    function claim(uint256[] memory transactionAmounts,uint256[] memory transactionTimestamps, uint256 userInitialBalance) external nonReentrant {
        uint256 userClaimAmount = pendingRewards(msg.sender, transactionAmounts, transactionTimestamps,userInitialBalance);
        require(userClaimAmount > 0, "No rewards to claim");

        userClaimTimestamp[msg.sender] = block.timestamp;

        (bool sent, bytes memory data) = payable(msg.sender).call{
            value: userClaimAmount
        }("");
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
        uint256 initialBalance) internal view returns (uint256) {
        uint256 userClaimTime = userClaimTimestamp[account];
        uint256 hoursToSeconds = 3600;

        (uint256 elapsedTimeInitial, uint256 elapsedTimeTxn, uint256 elapsedTimeCurrent,
         uint256 additionalTokens,uint256 firstTxnTimestamp,uint256 lastTxnTimestamp ) = (0, 0, 0, 0, 0, 0);

        uint256 timeSinceLastClaim = block.timestamp.sub(userClaimTime);
        if (timeSinceLastClaim < revenuePeriod) {
            return 0;
        }

        for (uint256 i = 0; i < amounts.length; i++) {
            additionalTokens += amounts[i];

            if (firstTxnTimestamp == 0) {
                firstTxnTimestamp = timestamps[i];
            }

            if (timestamps[i] > lastTxnTimestamp) {
                lastTxnTimestamp = timestamps[i];
            }
        }

        if (firstTxnTimestamp > 0) {
            elapsedTimeTxn = lastTxnTimestamp - firstTxnTimestamp;
            elapsedTimeInitial = userClaimTime == 0 ? firstTxnTimestamp.sub(block.timestamp - revenuePeriod) : firstTxnTimestamp.sub(userClaimTime);
            elapsedTimeCurrent = block.timestamp.sub(lastTxnTimestamp);
        }
        else {
            elapsedTimeInitial = userClaimTime == 0 ? block.timestamp.sub(revenuePeriod) : timeSinceLastClaim;
        }

        
        
        uint256 accountBalance = token.balanceOf(account);
        uint256 totalSupply = token.totalSupply();
        uint256 userHoldPercent = percentageOf(accountBalance, totalSupply);
        uint256 userAdditionalPercent = percentageOf(additionalTokens, totalSupply);
        uint256 userInitialPercent = percentageOf(initialBalance, totalSupply);
        uint256 initial_balance_share = userInitialPercent.mul(elapsedTimeInitial.div(hoursToSeconds.mul(24))) ; 
        uint256 additional_token_share = userAdditionalPercent.mul(elapsedTimeTxn.div(hoursToSeconds.mul(24)));
        uint256 current_balance_share = userHoldPercent.mul(elapsedTimeCurrent.div(hoursToSeconds.mul(24))) ; 
        

        
        
        uint256 userHoldPercentInEth = percent(
            current_balance_share,
            address(this).balance
        );
        uint256 userAdditionalPercentInEth = percent(
            additional_token_share,
            address(this).balance
        );
        uint256 userInitialPercentInEth = percent(
            initial_balance_share,
            address(this).balance
        );
        return userHoldPercentInEth.add(userInitialPercentInEth.add(userAdditionalPercentInEth));
    }

    // Function to calculate the percentage of a given number
    function percent(
        uint256 percentage,
        uint256 total
    ) public pure returns (uint256) {
        return (total * percentage) / 10000;
    }

    // Function to calculate the percentage of X is of Y
    function percentageOf(uint256 x, uint256 y) public pure returns (uint256) {
        return (x * 10000) / y;
    }

    
}
