// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IEntryPoint.sol";

interface IAccount {
    function validateUserOp(
        IEntryPoint.UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external view returns (uint256 validationData);

    function executeUserOp(
        IEntryPoint.UserOperation calldata userOp,
        bytes32 userOpHash
    ) external payable;

    function nonce() external view returns (uint256);
}