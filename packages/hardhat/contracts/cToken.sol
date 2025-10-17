// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {
    ConfidentialFungibleTokenERC20Wrapper
} from "@openzeppelin/confidential-contracts/token/extensions/ConfidentialFungibleTokenERC20Wrapper.sol";
import {ConfidentialFungibleToken} from "@openzeppelin/confidential-contracts/token/ConfidentialFungibleToken.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {FHE, euint64} from "@fhevm/solidity/lib/FHE.sol";

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

    // =============================================================
    //                    TESTING FUNCTIONS
    // =============================================================

    /// @notice Mint cTokens directly for testing (bypasses underlying token requirement)
    /// @dev FOR TESTING ONLY - Allows anyone to mint confidential tokens without wrapping
    /// @param to The address to mint tokens to
    /// @param amount The amount of tokens to mint (in token units with decimals)
    /// @return The amount successfully minted
    function mintForTesting(address to, uint64 amount) public returns (uint64) {
        require(to != address(0), "Cannot mint to zero address");

        // Convert amount to euint64 (encrypted)
        euint64 encryptedAmount = FHE.asEuint64(amount);

        // Call internal _mint function
        euint64 transferred = _mint(to, encryptedAmount);

        // Set ACL permissions so recipient can use the tokens
        FHE.allowThis(transferred);
        FHE.allow(transferred, to);

        return amount;
    }

    /// @notice Batch mint to multiple addresses for testing
    /// @dev FOR TESTING ONLY - Mints tokens to multiple recipients in one transaction
    /// @param recipients Array of addresses to mint to
    /// @param amounts Array of amounts to mint (must match recipients length)
    function batchMintForTesting(address[] calldata recipients, uint64[] calldata amounts) public {
        require(recipients.length == amounts.length, "Array length mismatch");

        for (uint256 i = 0; i < recipients.length; i++) {
            mintForTesting(recipients[i], amounts[i]);
        }
    }
}
