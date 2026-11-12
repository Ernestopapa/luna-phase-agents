// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title EoaTestCaller — LOCAL TESTS ONLY
/// @notice A contract that tries to call mint() on a target, so the
///         local suite can prove the EOA-only check (msg.sender ==
///         tx.origin) reverts for contract callers. Never deploy this
///         on testnet/mainnet and never point minters at it.
contract EoaTestCaller {
    function tryMint(address target, uint256 qty) external payable returns (bool) {
        (bool ok, ) = target.call{value: msg.value}(
            abi.encodeWithSignature("mint(uint256)", qty)
        );
        return ok;
    }
}
