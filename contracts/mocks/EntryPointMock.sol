// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IEntryPoint.sol";

contract EntryPointMock is IEntryPoint {
    mapping(address => uint256) public deposits;
    mapping(address => uint256) public stakes;
    mapping(address => uint32) public unstakeDelays;

    function depositTo(address account) external payable override {
        deposits[account] += msg.value;
    }

    function withdrawTo(address payable withdrawAddress, uint256 amount) external override {
        require(deposits[msg.sender] >= amount, "Insufficient deposit");
        deposits[msg.sender] -= amount;
        (bool success, ) = withdrawAddress.call{value: amount}("");
        require(success, "Transfer failed");
    }

    function addStake(uint32 unstakeDelaySec) external payable override {
        stakes[msg.sender] += msg.value;
        unstakeDelays[msg.sender] = unstakeDelaySec;
    }

    function unlockStake() external override {
        unstakeDelays[msg.sender] = 0;
    }

    function withdrawStake(address payable withdrawAddress) external override {
        require(unstakeDelays[msg.sender] == 0, "Stake locked");
        uint256 amount = stakes[msg.sender];
        stakes[msg.sender] = 0;
        (bool success, ) = withdrawAddress.call{value: amount}("");
        require(success, "Transfer failed");
    }

    function getDepositInfo(address account) external view override returns (uint256 deposit, uint256 staked) {
        return (deposits[account], stakes[account]);
    }

    function handleOps(UserOperation[] calldata userOps, address payable beneficiary) external override {
        // Mock implementation
    }

    function simulateValidation(
        UserOperation calldata /* userOp */,
        bytes32 /* userOpHash */,
        uint256 /* missingAccountFunds */
    ) external override returns (uint256 validationData) {
        return 0;
    }
}