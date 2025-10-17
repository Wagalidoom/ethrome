/**
 * Simple cToken Minting Example
 *
 * This script demonstrates how to use the new mintForTesting() function
 * to directly mint cTokens without needing to:
 * 1. Mint underlying ERC20 tokens
 * 2. Approve the cToken contract
 * 3. Wrap the tokens
 *
 * Perfect for quick testing and development!
 *
 * Run with: npx hardhat run scripts/simple-cToken-mint-example.ts --network localhost
 */

import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";

async function main() {
  console.log("\n🎯 Simple cToken Minting Example");
  console.log("=".repeat(50));

  await fhevm.initializeCLIApi();

  // Get signers
  const [deployer, alice, bob, charlie] = await ethers.getSigners();

  console.log("\n👥 Participants:");
  console.log(`  Alice: ${alice.address}`);
  console.log(`  Bob:   ${bob.address}`);
  console.log(`  Charlie: ${charlie.address}`);

  // Deploy contracts
  console.log("\n📦 Deploying contracts...");

  // Deploy MockERC20 (still needed as underlying token for the cToken contract)
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const mockToken = await MockERC20.deploy("Mock USDT", "mUSDT", 6);
  await mockToken.waitForDeployment();
  const mockTokenAddress = await mockToken.getAddress();

  // Deploy cToken
  const CToken = await ethers.getContractFactory("cToken");
  const cToken = await CToken.deploy(mockTokenAddress, "Confidential USDT", "cUSDT");
  await cToken.waitForDeployment();
  const cTokenAddress = await cToken.getAddress();

  console.log(`✅ MockERC20 deployed: ${mockTokenAddress}`);
  console.log(`✅ cToken deployed: ${cTokenAddress}`);

  // ===========================================
  // METHOD 1: Direct Mint (NEW - Super Simple!)
  // ===========================================
  console.log("\n" + "=".repeat(50));
  console.log("🚀 METHOD 1: Direct Mint (Recommended for Testing)");
  console.log("=".repeat(50));

  console.log("\n💎 Minting 300 cTokens directly to Alice...");
  await cToken.mintForTesting(alice.address, 300000000n); // 300 tokens (6 decimals)

  // Verify Alice's balance
  const aliceBalance = await cToken.confidentialBalanceOf(alice.address);
  const clearAliceBalance = await fhevm.userDecryptEuint(
    FhevmType.euint64,
    aliceBalance,
    cTokenAddress,
    alice
  );
  console.log(`✅ Alice's cToken balance: ${(Number(clearAliceBalance) / 1000000).toFixed(2)} tokens`);

  // ===========================================
  // METHOD 2: Batch Mint (Even Easier!)
  // ===========================================
  console.log("\n" + "=".repeat(50));
  console.log("🚀 METHOD 2: Batch Mint Multiple Users");
  console.log("=".repeat(50));

  console.log("\n💎 Batch minting to Bob and Charlie...");
  await cToken.batchMintForTesting(
    [bob.address, charlie.address],
    [200000000n, 150000000n] // 200 and 150 tokens
  );

  // Verify Bob's balance
  const bobBalance = await cToken.confidentialBalanceOf(bob.address);
  const clearBobBalance = await fhevm.userDecryptEuint(
    FhevmType.euint64,
    bobBalance,
    cTokenAddress,
    bob
  );
  console.log(`✅ Bob's cToken balance: ${(Number(clearBobBalance) / 1000000).toFixed(2)} tokens`);

  // Verify Charlie's balance
  const charlieBalance = await cToken.confidentialBalanceOf(charlie.address);
  const clearCharlieBalance = await fhevm.userDecryptEuint(
    FhevmType.euint64,
    charlieBalance,
    cTokenAddress,
    charlie
  );
  console.log(`✅ Charlie's cToken balance: ${(Number(clearCharlieBalance) / 1000000).toFixed(2)} tokens`);

  // ===========================================
  // Demonstration: Tokens work normally
  // ===========================================
  console.log("\n" + "=".repeat(50));
  console.log("✨ Tokens minted via mintForTesting() work normally!");
  console.log("=".repeat(50));

  console.log("\n📤 Alice transfers 50 tokens to Bob...");

  const transferAmount = 50000000n;
  const encryptedAmount = await fhevm
    .createEncryptedInput(cTokenAddress, alice.address)
    .add64(transferAmount)
    .encrypt();

  await cToken
    .connect(alice)
    ["confidentialTransfer(address,bytes32,bytes)"](
      bob.address,
      encryptedAmount.handles[0],
      encryptedAmount.inputProof
    );

  // Check new balances
  const newAliceBalance = await cToken.confidentialBalanceOf(alice.address);
  const clearNewAliceBalance = await fhevm.userDecryptEuint(
    FhevmType.euint64,
    newAliceBalance,
    cTokenAddress,
    alice
  );

  const newBobBalance = await cToken.confidentialBalanceOf(bob.address);
  const clearNewBobBalance = await fhevm.userDecryptEuint(
    FhevmType.euint64,
    newBobBalance,
    cTokenAddress,
    bob
  );

  console.log(`✅ Alice's new balance: ${(Number(clearNewAliceBalance) / 1000000).toFixed(2)} tokens (300 - 50 = 250)`);
  console.log(`✅ Bob's new balance: ${(Number(clearNewBobBalance) / 1000000).toFixed(2)} tokens (200 + 50 = 250)`);

  // ===========================================
  // Summary
  // ===========================================
  console.log("\n" + "=".repeat(50));
  console.log("📊 Summary");
  console.log("=".repeat(50));

  console.log(`
  🎯 Benefits of mintForTesting():

  ✅ No need to mint underlying ERC20 tokens
  ✅ No need to approve cToken contract
  ✅ No need to call wrap()
  ✅ One function call instead of 3-4 steps
  ✅ Anyone can mint (perfect for testing)
  ✅ Batch minting available for multiple users
  ✅ Minted tokens work exactly like wrapped tokens

  📝 Usage in your tests:

    // Old way (4 steps):
    await mockToken.mint(alice.address, amount);
    await mockToken.connect(alice).approve(cTokenAddress, amount);
    await cToken.connect(alice).wrap(alice.address, amount);

    // New way (1 step):
    await cToken.mintForTesting(alice.address, amount);

    // Batch mint:
    await cToken.batchMintForTesting(
      [alice.address, bob.address],
      [300000000n, 200000000n]
    );

  ⚠️  FOR TESTING ONLY - Do not use in production!
  `);

  console.log("=".repeat(50));
  console.log("✅ Example complete!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });
