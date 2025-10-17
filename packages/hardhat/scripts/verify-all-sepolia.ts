/**
 * Verify All Contracts on Sepolia
 *
 * This script verifies all deployed contracts on Sepolia Etherscan.
 * Run this AFTER deploying contracts with `npx hardhat deploy --network sepolia`
 *
 * Usage:
 *   npx hardhat run scripts/verify-all-sepolia.ts --network sepolia
 */

import { run, deployments } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  console.log("\n🔍 Verifying All Contracts on Sepolia");
  console.log("=".repeat(60));

  // Get all deployments for sepolia
  const allDeployments = await deployments.all();

  if (Object.keys(allDeployments).length === 0) {
    console.log("\n⚠️  No deployments found for Sepolia!");
    console.log("Run: npx hardhat deploy --network sepolia");
    return;
  }

  console.log(`\nFound ${Object.keys(allDeployments).length} deployed contracts\n`);

  // 1. Verify MockERC20
  if (allDeployments.MockERC20) {
    console.log("📝 Verifying MockERC20...");
    try {
      await run("verify:verify", {
        address: allDeployments.MockERC20.address,
        constructorArguments: ["Mock USDT", "mUSDT", 6],
      });
      console.log("✅ MockERC20 verified!");
      console.log(`   https://sepolia.etherscan.io/address/${allDeployments.MockERC20.address}#code\n`);
    } catch (error: any) {
      if (error.message.includes("Already Verified")) {
        console.log("✅ MockERC20 already verified!");
        console.log(`   https://sepolia.etherscan.io/address/${allDeployments.MockERC20.address}#code\n`);
      } else {
        console.log(`⚠️  MockERC20 verification failed: ${error.message}\n`);
      }
    }
  }

  // 2. Verify cToken
  if (allDeployments.cToken && allDeployments.MockERC20) {
    console.log("📝 Verifying cToken...");
    try {
      await run("verify:verify", {
        address: allDeployments.cToken.address,
        constructorArguments: [
          allDeployments.MockERC20.address,
          "Confidential USDT",
          "cUSDT",
        ],
      });
      console.log("✅ cToken verified!");
      console.log(`   https://sepolia.etherscan.io/address/${allDeployments.cToken.address}#code\n`);
    } catch (error: any) {
      if (error.message.includes("Already Verified")) {
        console.log("✅ cToken already verified!");
        console.log(`   https://sepolia.etherscan.io/address/${allDeployments.cToken.address}#code\n`);
      } else {
        console.log(`⚠️  cToken verification failed: ${error.message}\n`);
      }
    }
  }

  // 3. Verify FHESplit
  if (allDeployments.FHESplit && allDeployments.cToken) {
    console.log("📝 Verifying FHESplit...");
    try {
      // Get constructor args from deployment
      const fheSplitArgs = allDeployments.FHESplit.args || [
        allDeployments.cToken.address,
        allDeployments.FHESplit.receipt?.from, // deployer/bot address
      ];

      await run("verify:verify", {
        address: allDeployments.FHESplit.address,
        constructorArguments: fheSplitArgs,
      });
      console.log("✅ FHESplit verified!");
      console.log(`   https://sepolia.etherscan.io/address/${allDeployments.FHESplit.address}#code\n`);
    } catch (error: any) {
      if (error.message.includes("Already Verified")) {
        console.log("✅ FHESplit already verified!");
        console.log(`   https://sepolia.etherscan.io/address/${allDeployments.FHESplit.address}#code\n`);
      } else {
        console.log(`⚠️  FHESplit verification failed: ${error.message}\n`);
      }
    }
  }

  // Summary
  console.log("=".repeat(60));
  console.log("📊 Verification Summary");
  console.log("=".repeat(60));
  console.log("\nDeployed Contracts:");

  if (allDeployments.MockERC20) {
    console.log(`\n  MockERC20:`);
    console.log(`    Address: ${allDeployments.MockERC20.address}`);
    console.log(`    Etherscan: https://sepolia.etherscan.io/address/${allDeployments.MockERC20.address}`);
  }

  if (allDeployments.cToken) {
    console.log(`\n  cToken:`);
    console.log(`    Address: ${allDeployments.cToken.address}`);
    console.log(`    Etherscan: https://sepolia.etherscan.io/address/${allDeployments.cToken.address}`);
  }

  if (allDeployments.FHESplit) {
    console.log(`\n  FHESplit:`);
    console.log(`    Address: ${allDeployments.FHESplit.address}`);
    console.log(`    Etherscan: https://sepolia.etherscan.io/address/${allDeployments.FHESplit.address}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("\n✅ Verification process complete!");
  console.log("Check the links above to view your verified contracts.\n");

  // Save addresses to a JSON file
  const addressesFile = path.join(__dirname, "../sepolia-addresses.json");
  const addresses = {
    network: "sepolia",
    chainId: 11155111,
    timestamp: new Date().toISOString(),
    contracts: {
      MockERC20: allDeployments.MockERC20?.address || null,
      cToken: allDeployments.cToken?.address || null,
      FHESplit: allDeployments.FHESplit?.address || null,
    },
    deployer: allDeployments.FHESplit?.receipt?.from || null,
  };

  fs.writeFileSync(addressesFile, JSON.stringify(addresses, null, 2));
  console.log(`📄 Contract addresses saved to: ${addressesFile}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });
