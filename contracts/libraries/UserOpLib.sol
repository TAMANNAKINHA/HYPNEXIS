// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../interfaces/IEntryPoint.sol";

library UserOpLib {
    function getSender(IEntryPoint.UserOperation calldata userOp) internal pure returns (address) {
        return userOp.sender;
    }

    function getCallData(IEntryPoint.UserOperation calldata userOp) internal pure returns (bytes memory) {
        return userOp.callData;
    }

    function hashUserOp(
        IEntryPoint.UserOperation calldata userOp,
        uint256 chainId,
        address entryPoint
    ) internal pure returns (bytes32) {
        return keccak256(abi.encode(
            userOp.sender,
            userOp.nonce,
            keccak256(userOp.initCode),
            keccak256(userOp.callData),
            userOp.callGasLimit,
            userOp.verificationGasLimit,
            userOp.preVerificationGas,
            userOp.maxFeePerGas,
            userOp.maxPriorityFeePerGas,
            keccak256(userOp.paymasterAndData),
            chainId,
            entryPoint
        ));
    }

    function validateSignature(
        address signer,
        bytes32 hash,
        bytes memory signature
    ) internal pure returns (bool) {
        if (signature.length != 65) return false;
        
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := mload(add(signature, 96))
        }
        
        // Adjust v if needed (some wallets use 0/1, others 27/28)
        if (v < 27) {
            v += 27;
        }
        
        address recovered = ecrecover(hash, v, r, s);
        return recovered == signer;
    }
}