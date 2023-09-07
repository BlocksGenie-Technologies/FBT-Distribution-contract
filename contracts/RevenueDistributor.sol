// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "hardhat/console.sol";

contract RevenueDistributor is Ownable, ReentrancyGuard {
    IERC20 public token;
    uint256 public revenuePeriod;
    uint256 public totalRewardDistributed;
    uint256 public lastDistributionTimestamp;
    address public manager;

    struct UserDetails {
        address user;
        uint256[] timestamp;
        uint256[] amount;
        uint256 last24HourBalance;
    }

    mapping(address => uint256) public rewardClaimable;
    mapping(address => bool) private isBlacklist;

    modifier onlyManager() {
        require(msg.sender == manager, "Not manager");
        _;
    }

    constructor(address _tokenAddress, address _manager) {
        require(_tokenAddress != address(0), "Invalid tokenAddress");
        require(_manager != address(0), "Invalid address");
        token = IERC20(_tokenAddress);
        manager = _manager;
        revenuePeriod = 1 days;
    }

    receive() external payable {}

    function setTokenAddress(address _tokenAddress) external onlyOwner {
        require(_tokenAddress != address(0), "Invalid tokenAddress");
        token = IERC20(_tokenAddress);
    }

    function setManagerAddress(address _manager) external onlyOwner {
        require(_manager != address(0), "Invalid address");
        manager = _manager;
    }

    function getLastDistributionTime() external view returns (uint256) {
        return lastDistributionTimestamp;
    }

    function blacklist(address[] memory a) external onlyManager {
        for (uint256 i = 0; i < a.length; i) {
            isBlacklist[a[i]] = true;
        }
    }

    function distribute(
        UserDetails[] calldata _userDetails,
        uint256 distributedAmount
    ) external payable onlyManager {
        require(
            address(this).balance >= distributedAmount,
            "Insufficient funds"
        );
        for (uint256 i = 0; i < _userDetails.length; i++) {
            require(!isBlacklist[_userDetails[i].user]);
            uint256 userClaimAmount = calculateShare(
                distributedAmount,
                _userDetails[i].user,
                _userDetails[i].amount,
                _userDetails[i].timestamp,
                _userDetails[i].last24HourBalance
            );

            console.log("Wallet", _userDetails[i].user);
            if (userClaimAmount > 0) {
                rewardClaimable[_userDetails[i].user] += userClaimAmount;
                totalRewardDistributed += userClaimAmount;
                console.log(
                    "Distribution amount",
                    rewardClaimable[_userDetails[i].user]
                );
            }
        }
        lastDistributionTimestamp = block.timestamp;
    }

    function claim() external nonReentrant {
        console.log("user", msg.sender);
        uint256 userClaimAmount = rewardClaimable[msg.sender];
        require(userClaimAmount > 0, "Nothing to claim");
        require(address(this).balance >= userClaimAmount, "Insufficient funds");

        rewardClaimable[msg.sender] = 0;
        (bool sent, ) = payable(msg.sender).call{value: userClaimAmount}("");
        require(sent, "Failed to send Ether");
    }

    function pendingRewards(address account) external view returns (uint256) {
        return rewardClaimable[account];
    }

    /*
    Gets distributed to all holders of fbt tokens depending on how much fbt tokens they hold

    The more they hold the more rewards they get
     * @dev Calculate pending rewards
     * @param account user address
     * @param amounts array of user additional amounts in last 24hr
     * @param timestamps array of timestamps in last 24hr transactions
     * @param initialBalance user balance in last 24hr
     * @return Peding rewards
     */
    function calculateShare(
        uint256 distributedAmount,
        address account,
        uint256[] memory amounts,
        uint256[] memory timestamps,
        uint256 initialBalance
    ) public view returns (uint256) {
        require(amounts.length == timestamps.length);

        uint256 timeSinceLastDistribute = block.timestamp -
            lastDistributionTimestamp;
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
        uint256 elapsedTimeInitial = firstTxnTimestamp == 0
            ? revenuePeriod
            : firstTxnTimestamp - timeSinceLastDistribute;

        uint256 elapsedTimeCurrent = lastTxnTimestamp == 0
            ? 0
            : block.timestamp - lastTxnTimestamp;

        uint256 calculatedRewardPercent = _calculateShare(
            account,
            elapsedTimeInitial,
            elapsedTimeTxn,
            elapsedTimeCurrent,
            initialBalance,
            additionalTokens
        );

        return (calculatedRewardPercent * distributedAmount) / 10000;
    }

    /* function to calculate the share of the caller address, summation of percentage of the last 24hrs balance, 
    addtional amounts gotten from transactions within 24hrs and the user current balance multiple by their respective elapsed timestamps
    */
    function _calculateShare(
        address _account,
        uint256 elapsedTimeInitial,
        uint256 elapsedTimeTxn,
        uint256 elapsedTimeCurrent,
        uint256 initialBalance,
        uint256 additionalTokens
    ) internal view returns (uint256) {
        uint256 hoursToSeconds = 3600;
        uint256 accountBalance = token.balanceOf(_account);
        uint256 totalSupply = token.totalSupply();

        uint256 userHoldPercent = (accountBalance * 10000) / totalSupply;
        uint256 userAdditionalPercent = (additionalTokens * 10000) /
            totalSupply;
        uint256 userInitialPercent = (initialBalance * 10000) / totalSupply;

        uint256 initialBalanceShare = (userInitialPercent *
            elapsedTimeInitial) / (hoursToSeconds * 24);
        uint256 additionalTokenShare = (userAdditionalPercent *
            elapsedTimeTxn) / (hoursToSeconds * 24);
        uint256 currentBalanceShare = (userHoldPercent * elapsedTimeCurrent) /
            (hoursToSeconds * 24);

        uint256 calculatedRewardPercent = initialBalanceShare +
            additionalTokenShare +
            currentBalanceShare;

        return calculatedRewardPercent;
    }

    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0);
        (bool sent, ) = payable(msg.sender).call{value: balance}("");
        require(sent, "Failed to send Ether");
    }
}
