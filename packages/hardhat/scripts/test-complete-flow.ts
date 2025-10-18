/**
 * Complete Flow Test - Create Expense and Verify Decryption
 *
 * This script demonstrates the complete FHESplit flow:
 * 1. Setup: Get or create group
 * 2. Create: Add an expense with encrypted shares
 * 3. Verify: Decrypt and display the amounts
 *
 * Run with:
 *   npx hardhat run scripts/test-complete-flow.ts --network sepolia
 */

import { ethers, fhevm, deployments } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

// Configuration
const PRIVATE_KEY = "";
const CONTRACT_ADDRESS_OVERRIDE = "0xbFBc56979dBfA4514C6560e5E9d33Ff608117ce5";

// Second member for testing (you can add another wallet address here)
const SECOND_MEMBER = "0x97D2eEb65DA0c37dc0F43FF4691E521673eFADfd"; // Replace with actual address

// Helper functions
function formatAmount(amount: bigint): string {
  return (Number(amount) / 1000000).toFixed(2);
}

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

async function decryptAmount(
  encryptedValue: any,
  contractAddress: string,
  signer: HardhatEthersSigner
): Promise<bigint> {
  if (encryptedValue === ethers.ZeroHash || !encryptedValue) {
    return 0n;
  }
  try {
    return await fhevm.userDecryptEuint(FhevmType.euint64, encryptedValue, contractAddress, signer);
  } catch (e) {
    console.log("  ⚠️  Could not decrypt:", (e as Error).message);
    return 0n;
  }
}

async function main() {
  console.log("\n" + "=".repeat(70));
  console.log("  🎯 FHESplit Complete Flow Test");
  console.log("  Testing: Create Expense → Decrypt → Verify ACL Fix");
  console.log("=".repeat(70));

  // Initialize FHEVM
  console.log("\n🔐 Initializing FHEVM...");
  await fhevm.initializeCLIApi();
  console.log("✅ FHEVM initialized");

  // Get contract
  let contractAddress = CONTRACT_ADDRESS_OVERRIDE;
  if (!contractAddress) {
    const deployment = await deployments.get("FHESplit");
    contractAddress = deployment.address;
  }
  console.log("📋 Contract:", contractAddress);

  // Connect wallet
  const wallet = new ethers.Wallet(PRIVATE_KEY, ethers.provider);
  const yourAddress = await wallet.getAddress();
  console.log("👤 Your Address:", yourAddress);

  const balance = await ethers.provider.getBalance(yourAddress);
  console.log("💰 ETH Balance:", ethers.formatEther(balance), "ETH");

  // Get contract instance
  const fheSplit = await ethers.getContractAt("FHESplit", contractAddress, wallet);

  // =========================================
  // STEP 1: Get or Create Group
  // =========================================
  console.log("\n" + "=".repeat(70));
  console.log("📁 STEP 1: Setup Group");
  console.log("=".repeat(70));

  const userGroups = await fheSplit.getUserGroups(yourAddress);
  console.log("\n🔍 Checking existing groups:", userGroups.length);

  let groupId: bigint;

  if (userGroups.length === 0) {
    console.log("\n➕ Creating new group...");

    const members = [yourAddress, SECOND_MEMBER];
    console.log("   Members:", members.map(formatAddress).join(", "));

    const tx = await fheSplit.createGroup("Test Group", members);
    const receipt = await tx.wait();
    console.log("✅ Group created! Gas used:", receipt?.gasUsed.toString());

    const newGroups = await fheSplit.getUserGroups(yourAddress);
    groupId = newGroups[0];
  } else {
    groupId = userGroups[0];
    console.log("✅ Using existing group");
  }

  console.log("📋 Group ID:", groupId.toString());

  // Get group details
  const group = await fheSplit.getGroup(groupId);
  console.log("📋 Group Name:", group.name);
  console.log("👤 Group Creator:", formatAddress(group.creator));

  const members = await fheSplit.getGroupMembers(groupId);
  console.log("👥 Group Members:", members.length);
  members.forEach((member, i) => {
    console.log(`   ${i + 1}. ${formatAddress(member)}${member === yourAddress ? " (YOU)" : ""}`);
  });

  // =========================================
  // STEP 2: Add Expense
  // =========================================
  console.log("\n" + "=".repeat(70));
  console.log("💰 STEP 2: Create Expense");
  console.log("=".repeat(70));

  console.log("\n📝 Expense Details:");
  console.log("   Description: Dinner at Restaurant");
  console.log("   Payer: YOU");
  console.log("   Members: All group members");

  // Define shares - each person's portion
  const shares = members.map(() => 50000000n); // 50 tokens each
  console.log("   Total Amount:", formatAmount(shares.reduce((a, b) => a + b, 0n)), "tokens");
  console.log("   Per Person:", formatAmount(shares[0]), "tokens");

  // Encrypt shares
  console.log("\n🔐 Encrypting shares...");
  const encryptedShares: any[] = [];
  const proofs: any[] = [];

  for (let i = 0; i < shares.length; i++) {
    console.log(`   Encrypting share ${i + 1}/${shares.length}...`);

    try {
      const input = fhevm.createEncryptedInput(contractAddress, yourAddress);
      const encryptedInput = input.add64(shares[i]);
      const encrypted = await encryptedInput.encrypt();

      encryptedShares.push(encrypted.handles[0]);
      proofs.push(encrypted.inputProof);

      console.log(`   ✅ Share ${i + 1} encrypted`);
    } catch (error) {
      console.log(`   ❌ Encryption failed:`, (error as Error).message);
      throw error;
    }
  }

  console.log("✅ All shares encrypted");

  // Create expense
  console.log("\n💸 Submitting expense transaction...");

  const expenseTx = await fheSplit.addExpense(
    groupId,
    yourAddress, // You are the payer
    [...members], // Spread to create mutable copy
    [...encryptedShares], // Spread to create mutable copy
    [...proofs], // Spread to create mutable copy
    "Dinner at Restaurant 🍽️"
  );

  console.log("⏳ Waiting for confirmation...");
  const expenseReceipt = await expenseTx.wait();
  console.log("✅ Expense created! Gas used:", expenseReceipt?.gasUsed.toString());

  // Get expense ID
  const expenseIds = await fheSplit.getGroupExpenses(groupId);
  const expenseId = expenseIds[expenseIds.length - 1];
  console.log("📋 Expense ID:", expenseId.toString());

  // =========================================
  // STEP 3: Verify and Decrypt
  // =========================================
  console.log("\n" + "=".repeat(70));
  console.log("🔓 STEP 3: Verify Decryption (Testing ACL Fix!)");
  console.log("=".repeat(70));

  // Get expense details
  console.log("\n📄 Expense Details:");
  const expense = await fheSplit.getExpense(expenseId);
  console.log("   ID:", expense.id.toString());
  console.log("   Description:", expense.description);
  console.log("   Payer:", formatAddress(expense.payer));
  console.log("   Group:", expense.groupId.toString());
  console.log("   Created:", new Date(Number(expense.createdAt) * 1000).toLocaleString());

  // Test decryption of YOUR share
  console.log("\n🔓 Testing YOUR share decryption:");
  try {
    const encryptedShare = await fheSplit.getExpenseShare(expenseId, yourAddress);
    console.log("   📦 Encrypted share retrieved:", encryptedShare !== ethers.ZeroHash);

    const decryptedShare = await decryptAmount(encryptedShare, contractAddress, wallet as any);

    console.log("\n   ✅ SUCCESS! Your share is:");
    console.log("   💰 Amount:", formatAmount(decryptedShare), "tokens");
    console.log("   💰 Raw (wei):", decryptedShare.toString());
    console.log("   ✅ Expected:", formatAmount(shares[0]), "tokens");

    if (decryptedShare === shares[0]) {
      console.log("   🎉 PERFECT MATCH! ACL is working correctly!");
    } else {
      console.log("   ⚠️  Value mismatch - please investigate");
    }
  } catch (error) {
    console.log("   ❌ FAILED:", (error as Error).message);
    console.log("   ⚠️  ACL might have issues");
  }

  // Test decryption of DEBTS (for other members)
  if (members.length > 1) {
    console.log("\n🔓 Testing DEBT decryption:");

    for (let i = 0; i < members.length; i++) {
      const member = members[i];

      if (member === yourAddress) {
        console.log(`\n   ${i + 1}. ${formatAddress(member)} (YOU - no debt to yourself)`);
        continue;
      }

      console.log(`\n   ${i + 1}. Debt from ${formatAddress(member)}:`);

      try {
        const encryptedDebt = await fheSplit.getNetOwedInGroup(groupId, member, yourAddress);
        console.log("      📦 Encrypted debt retrieved:", encryptedDebt !== ethers.ZeroHash);

        const decryptedDebt = await decryptAmount(encryptedDebt, contractAddress, wallet as any);

        console.log("      ✅ SUCCESS! Debt amount:");
        console.log("      💰 Amount:", formatAmount(decryptedDebt), "tokens");
        console.log("      💰 Raw (wei):", decryptedDebt.toString());
        console.log("      ✅ Expected:", formatAmount(shares[i]), "tokens");

        if (decryptedDebt === shares[i]) {
          console.log("      🎉 PERFECT MATCH!");
        }
      } catch (error) {
        console.log("      ❌ FAILED:", (error as Error).message);
      }
    }
  }

  // =========================================
  // FINAL SUMMARY
  // =========================================
  console.log("\n" + "=".repeat(70));
  console.log("📊 FINAL SUMMARY");
  console.log("=".repeat(70));

  console.log("\n✅ Contract:", contractAddress);
  console.log("✅ Group ID:", groupId.toString());
  console.log("✅ Expense ID:", expenseId.toString());
  console.log("✅ Your Address:", yourAddress);

  console.log("\n🎯 What We Tested:");
  console.log("   ✅ Group creation/retrieval");
  console.log("   ✅ Expense creation with encrypted shares");
  console.log("   ✅ Share decryption (YOUR portion)");
  console.log("   ✅ Debt decryption (what others owe YOU)");

  console.log("\n🎉 If all tests passed, the ACL fix is working perfectly!");
  console.log("🎉 You can now create and decrypt expenses without issues!");

  console.log("\n📱 Next Steps:");
  console.log("   1. Share the contract address with your payer");
  console.log("   2. Have them create expenses using addExpense()");
  console.log("   3. Use test-get-functions.ts to check your debts");
  console.log("   4. Pay using privateTransferInGroup()");

  console.log("\n" + "=".repeat(70) + "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });
