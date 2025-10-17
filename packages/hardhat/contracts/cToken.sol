// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {
    ConfidentialFungibleTokenERC20Wrapper
} from "@openzeppelin/confidential-contracts/token/extensions/ConfidentialFungibleTokenERC20Wrapper.sol";
import {ConfidentialFungibleToken} from "@openzeppelin/confidential-contracts/token/ConfidentialFungibleToken.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title cToken - Confidential Token Wrapper
/// @notice A confidential ERC20 token wrapped around a regular ERC20 token using FHE
/// @dev This contract wraps a regular ERC20 token to provide confidential transactions
contract cToken is ConfidentialFungibleTokenERC20Wrapper, SepoliaConfig {
    /// @notice Constructor to initialize the confidential token
    /// @param underlyingToken The address of the underlying ERC20 token to wrap
    /// @param tokenName The name of the confidential token
    /// @param tokenSymbol The symbol of the confidential token
    constructor(
        IERC20 underlyingToken,
        string memory tokenName,
        string memory tokenSymbol
    )
        ConfidentialFungibleTokenERC20Wrapper(underlyingToken)
        ConfidentialFungibleToken(tokenName, tokenSymbol, "")
    {
        // Constructor body - the parent constructors handle initialization
    }

    /// @notice Override decimals to match the underlying token
    /// @return The number of decimals
    function decimals() public view virtual override returns (uint8) {
        return 6; // Most stablecoins use 6 decimals (USDT, USDC)
    }
}
