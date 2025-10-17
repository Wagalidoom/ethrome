/**
 * Check Deployer Balance
 *
 * Quick script to check your deployer's ETH balance on any network
 *
 * Usage:
 *   npx hardhat run scripts/check-balance.ts --network sepolia
 *   npx hardhat run scripts/check-balance.ts --network localhost
 */

import { ethers } from "hardhat";

async function main() {
  console.log("\n💰 Checking Deployer Balance");
  console.log("=".repeat(50));

  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  const network = await ethers.provider.getNetwork();

  console.log(`\n📍 Network: ${network.name} (Chain ID: ${network.chainId})`);
  console.log(`👤 Deployer: ${deployer.address}`);
  console.log(`💵 Balance: ${ethers.formatEther(balance)} ETH`);

  // Estimate if balance is sufficient for deployment
  const estimatedGasCost = ethers.parseEther("0.01"); // Conservative estimate
  const hasSufficientFunds = balance > estimatedGasCost;

  console.log(`\n${hasSufficientFunds ? "✅" : "⚠️"}  ${
    hasSufficientFunds
      ? "Sufficient funds for deployment"
      : "WARNING: Low balance! Get more ETH from faucet"
  }`);

  if (!hasSufficientFunds && network.chainId === 11155111n) {
    console.log("\n🚰 Get Sepolia ETH from:");
    console.log("   • https://sepoliafaucet.com/");
    console.log("   • https://www.infura.io/faucet/sepolia");
    console.log("   • https://faucets.chain.link/sepolia");
  }

  console.log("\n" + "=".repeat(50) + "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });
