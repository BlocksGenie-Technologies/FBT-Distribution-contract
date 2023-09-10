// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "hardhat/console.sol";

contract RevenueDistributor is Ownable, ReentrancyGuard {
    uint256 public totalRewardDistributed;
    uint256 public lastDistributionTimestamp;
    address public manager;

    struct UserDetails {
        address user;
        uint256 reward;
    }

    mapping(address => UserDetails) public rewardClaimable;
    mapping(address => bool) private isBlacklist;

    modifier onlyManager() {
        require(msg.sender == manager, "Not manager");
        _;
    }

    constructor(address _manager) {
        require(_manager != address(0), "Invalid address");
        manager = _manager;
        totalRewardDistributed = 0;
    }

    receive() external payable {
        totalRewardDistributed += msg.value;
    }


    function setManagerAddress(address _manager) external onlyOwner {
        require(_manager != address(0), "Invalid address");
        manager = _manager;
    }

    function getLastDistributionTime() external view returns (uint256) {
        return lastDistributionTimestamp;
    }

    function blacklist(address[] memory a) external onlyManager {
        for (uint256 i = 0; i < a.length; i++) {
            isBlacklist[a[i]] = true;
        }
    }

    function distribute(
        UserDetails[] calldata _userDetails
    ) external onlyManager {

        for (uint256 i = 0; i < _userDetails.length; i++) {
            require(!isBlacklist[_userDetails[i].user]);
            uint256 userClaimAmount = _userDetails[i].reward;
            rewardClaimable[_userDetails[i].user].user = _userDetails[i].user;
            rewardClaimable[_userDetails[i].user].reward += userClaimAmount;

        }
        lastDistributionTimestamp = block.timestamp;
    }

    function claim() external nonReentrant {
        console.log("user", msg.sender);
        uint256 userClaimAmount = rewardClaimable[msg.sender].reward;
        require(userClaimAmount > 0, "Nothing to claim");
        require(address(this).balance >= userClaimAmount, "Insufficient funds");

        (bool sent, ) = payable(msg.sender).call{value: userClaimAmount}("");
        require(sent, "Failed to send Ether");

        rewardClaimable[msg.sender].reward = 0;
    }

    function pendingRewards(address account) external view returns (uint256) {
        return rewardClaimable[account].reward;
    }

    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "Insufficient funds");
        (bool sent, ) = payable(msg.sender).call{value: balance}("");
        require(sent, "Failed to send Ether");
    }
}
