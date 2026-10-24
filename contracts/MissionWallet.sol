// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title MissionWallet
 * @dev A programmable wallet for AI missions with governance controls
 */
contract MissionWallet is Ownable, ReentrancyGuard {
    string public missionName;
    string public missionId;
    string public category;
    uint256 public budget;
    uint256 public spent;
    bool public frozen;
    uint256 public expiry;
    address public merchant;

    uint256 public timelockSeconds;
    bool public executed;
    bool public refunded;

    event MissionCreated(string missionId, uint256 budget, address merchant);
    event MissionExecuted(string missionId, uint256 amount, address merchant);
    event MissionFrozen(string missionId);
    event MissionUnfrozen(string missionId);
    event MissionRefunded(string missionId, uint256 amount);
    event MissionNuked(string missionId);

    modifier onlyIfNotFrozen() {
        require(!frozen, "MissionWallet: Wallet is frozen");
        _;
    }

    modifier onlyIfNotExecuted() {
        require(!executed, "MissionWallet: Mission already executed");
        _;
    }

    modifier onlyIfNotExpired() {
        require(block.timestamp < expiry, "MissionWallet: Mission expired");
        _;
    }

    constructor(
        string memory _missionName,
        string memory _missionId,
        string memory _category,
        uint256 _budget,
        address _merchant,
        uint256 _timelockSeconds,
        uint256 _expirySeconds
    ) Ownable(msg.sender) {
        require(_budget > 0, "MissionWallet: Budget must be > 0");
        require(_merchant != address(0), "MissionWallet: Merchant cannot be zero address");

        missionName = _missionName;
        missionId = _missionId;
        category = _category;
        budget = _budget;
        spent = 0;
        frozen = false;
        merchant = _merchant;
        timelockSeconds = _timelockSeconds;
        expiry = block.timestamp + _expirySeconds;
        executed = false;
        refunded = false;

        emit MissionCreated(_missionId, _budget, _merchant);
    }

    function execute(uint256 amount)
        external
        onlyOwner
        onlyIfNotFrozen
        onlyIfNotExecuted
        onlyIfNotExpired
        nonReentrant
    {
        require(amount > 0, "MissionWallet: Amount must be > 0");
        require(amount <= budget - spent, "MissionWallet: Insufficient remaining budget");
        require(amount <= budget / 10, "MissionWallet: Single transaction cannot exceed 10% of budget");

        spent += amount;
        executed = true;

        emit MissionExecuted(missionId, amount, merchant);
    }

    function freeze() external onlyOwner {
        frozen = true;
        emit MissionFrozen(missionId);
    }

    function unfreeze() external onlyOwner {
        frozen = false;
        emit MissionUnfrozen(missionId);
    }

    function refund() external onlyOwner onlyIfNotExecuted nonReentrant {
        require(!refunded, "MissionWallet: Already refunded");
        uint256 remaining = budget - spent;
        require(remaining > 0, "MissionWallet: No remaining balance");

        refunded = true;
        emit MissionRefunded(missionId, remaining);
    }

    function nuke() external onlyOwner nonReentrant {
        uint256 remaining = budget - spent;

        frozen = true;
        executed = true;

        if (remaining > 0 && !refunded) {
            refunded = true;
            emit MissionRefunded(missionId, remaining);
        }

        emit MissionNuked(missionId);
    }

    function remainingBudget() external view returns (uint256) {
        return budget - spent;
    }

    function isActive() external view returns (bool) {
        return block.timestamp < expiry && !executed && !frozen;
    }

    function getStatus() external view returns (string memory) {
        if (frozen) return "Frozen";
        if (executed) return "Executed";
        if (refunded) return "Refunded";
        if (block.timestamp >= expiry) return "Expired";
        return "Active";
    }
}