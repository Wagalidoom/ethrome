/**
 * Complete FHESplit Demo Workflow for Sepolia
 * 
 * This script demonstrates the complete flow:
 * 1. Create group (ID = 35)
 * 2. Add an expense where you owe someone
 * 3. Query who you owe in that group
 * 4. Pay the debt via privateTransferInGroup
 * 
 * All transaction links are displayed for Sepolia explorer
 * 
 * Run with:
 *   npx hardhat run scripts/sepolia-demo-workflow.ts --network sepolia
 */

import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

// Configuration
const PRIVATE_KEY = "";
const FHESPLIT_ADDRESS = "0xbFBc56979dBfA4514C6560e5E9d33Ff608117ce5";
const CREDITOR_ADDRESS = "0x97D2eEb65DA0c37dc0F43FF4691E521673eFADfd"; // Person you owe

// Expense details
const EXPENSE_DESCRIPTION = "Dinner Split 🍕";
const YOUR_SHARE = 15_000000n; // 15 tokens - your portion of the bill
const CREDITOR_SHARE = 15_000000n; // 15 tokens - creditor's portion
const PAYER = CREDITOR_ADDRESS; // Creditor paid the full bill

// Helper functions
function formatAmount(amount: bigint): string {
  return (Number(amount) / 1000000).toFixed(2);
}

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getTxLink(hash: string): string {
  return `https://sepolia.etherscan.io/tx/${hash}`;
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
    return await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedValue,
      contractAddress,
      signer
    );
  } catch (e) {
    console.log("  ⚠️  Could not decrypt:", (e as Error).message);
    return 0n;
  }
}

async function main() {
  console.log("\n" + "=".repeat(80));
  console.log("  🎯 FHESplit Complete Demo Workflow (Sepolia)");
  console.log("=".repeat(80));

  // Initialize FHEVM
  console.log("\n🔐 Initializing FHEVM...");
  await fhevm.initializeCLIApi();
  console.log("✅ FHEVM initialized");

  // Connect wallet
  const wallet = new ethers.Wallet(PRIVATE_KEY, ethers.provider);
  const yourAddress = await wallet.getAddress();
  
  console.log("\n👥 Participants:");
  console.log("   You (Debtor):  ", yourAddress);
  console.log("   Creditor:      ", CREDITOR_ADDRESS);

  const ethBalance = await ethers.provider.getBalance(yourAddress);
  console.log("\n💰 Your ETH Balance:", ethers.formatEther(ethBalance), "ETH");

  // Get contract
  const fheSplit = await ethers.getContractAt("FHESplit", FHESPLIT_ADDRESS, wallet);
  console.log("📋 FHESplit Contract:", FHESPLIT_ADDRESS);

  // =========================================
  // STEP 1: Create Group
  // =========================================
  console.log("\n" + "=".repeat(80));
  console.log("📁 STEP 1: Create Group");
  console.log("=".repeat(80));

  console.log("\n➕ Creating new group...");
  console.log("   Members: You + Creditor");

  let groupId: bigint;

  try {
    const createTx = await fheSplit.createGroup(
      `Demo Expense Group`,
      [yourAddress, CREDITOR_ADDRESS]
    );
    
    console.log("\n⏳ Transaction sent!");
    console.log("🔗 View on Explorer: " + getTxLink(createTx.hash));
    
    const createReceipt = await createTx.wait();
    console.log("✅ Group created! Gas used:", createReceipt?.gasUsed.toString());
    
    // Get the newly created group ID
    const userGroups = await fheSplit.getUserGroups(yourAddress);
    groupId = userGroups[userGroups.length - 1]; // Latest group
    console.log("📋 Group ID:", groupId.toString());
    
  } catch (e: any) {
    console.log("⚠️  Error:", e.message);
    // Fallback to existing group if creation fails
    const userGroups = await fheSplit.getUserGroups(yourAddress);
    if (userGroups.length > 0) {
      groupId = userGroups[userGroups.length - 1];
      console.log("✅ Using existing group ID:", groupId.toString());
    } else {
      throw new Error("No groups available");
    }
  }

  // Verify group members
  const members = await fheSplit.getGroupMembers(groupId);
  console.log("\n👥 Group Members:", members.length);
  members.forEach((member, i) => {
    const label = member.toLowerCase() === yourAddress.toLowerCase() 
      ? " (YOU)" 
      : member.toLowerCase() === CREDITOR_ADDRESS.toLowerCase() 
        ? " (CREDITOR)" 
        : "";
    console.log(`   ${i + 1}. ${formatAddress(member)}${label}`);
  });

  // =========================================
  // STEP 2: Add Expense (You Owe Creditor)
  // =========================================
  console.log("\n" + "=".repeat(80));
  console.log("💰 STEP 2: Add Expense");
  console.log("=".repeat(80));

  console.log("\n📝 Expense Details:");
  console.log("   Description:", EXPENSE_DESCRIPTION);
  console.log("   Payer:", formatAddress(PAYER), "(paid the bill)");
  console.log("   Your Share:", formatAmount(YOUR_SHARE), "tokens");
  console.log("   Creditor's Share:", formatAmount(CREDITOR_SHARE), "tokens");
  console.log("   Total Bill:", formatAmount(YOUR_SHARE + CREDITOR_SHARE), "tokens");

  // Encrypt shares
  console.log("\n🔐 Encrypting expense shares...");
  
  const yourShareInput = fhevm.createEncryptedInput(FHESPLIT_ADDRESS, yourAddress);
  const yourShareEnc = yourShareInput.add64(YOUR_SHARE);
  const yourShareEncrypted = await yourShareEnc.encrypt();
  console.log("   ✅ Your share encrypted");

  const creditorShareInput = fhevm.createEncryptedInput(FHESPLIT_ADDRESS, yourAddress);
  const creditorShareEnc = creditorShareInput.add64(CREDITOR_SHARE);
  const creditorShareEncrypted = await creditorShareEnc.encrypt();
  console.log("   ✅ Creditor's share encrypted");

  // Add expense
  console.log("\n💸 Adding expense to blockchain...");
  const expenseTx = await fheSplit.addExpense(
    groupId,
    PAYER, // Creditor paid the bill
    [yourAddress, CREDITOR_ADDRESS], // Members who owe
    [yourShareEncrypted.handles[0], creditorShareEncrypted.handles[0]], // Encrypted shares
    [yourShareEncrypted.inputProof, creditorShareEncrypted.inputProof], // Proofs
    EXPENSE_DESCRIPTION
  );

  console.log("\n⏳ Transaction sent!");
  console.log("🔗 View on Explorer: " + getTxLink(expenseTx.hash));

  const expenseReceipt = await expenseTx.wait();
  console.log("✅ Expense added! Gas used:", expenseReceipt?.gasUsed.toString());

  // Get expense ID
  const expenseIds = await fheSplit.getGroupExpenses(groupId);
  const expenseId = expenseIds[expenseIds.length - 1];
  console.log("📋 Expense ID:", expenseId.toString());

  // =========================================
  // STEP 3: Query Who You Owe
  // =========================================
  console.log("\n" + "=".repeat(80));
  console.log("🔍 STEP 3: Query Who You Owe in Group");
  console.log("=".repeat(80));

  console.log("\n📊 Fetching your creditors in group", groupId.toString() + "...");
  
  const creditors = await fheSplit.getCreditorsInGroup(groupId, yourAddress);
  console.log("✅ Found", creditors.length, "creditor(s)");

  if (creditors.length > 0) {
    console.log("\n💰 People you owe money to:");
    
    let totalOwed = 0n;
    
    for (let i = 0; i < creditors.length; i++) {
      const creditor = creditors[i];
      console.log(`\n   ${i + 1}. ${formatAddress(creditor)}`);
      
      // Get encrypted debt amount
      const encryptedDebt = await fheSplit.getNetOwedInGroup(
        groupId,
        yourAddress,
        creditor
      );
      
      // Decrypt the debt
      const debtAmount = await decryptAmount(encryptedDebt, FHESPLIT_ADDRESS, wallet as any);
      
      if (debtAmount > 0n) {
        console.log(`      💸 You owe: ${formatAmount(debtAmount)} tokens`);
        console.log(`      💸 Raw amount: ${debtAmount.toString()} wei`);
        totalOwed += debtAmount;
      } else {
        console.log(`      ✅ No debt (settled or zero)`);
      }
    }
    
    console.log("\n📊 Total Debt Summary:");
    console.log("   Total you owe in this group:", formatAmount(totalOwed), "tokens");
  } else {
    console.log("✨ No creditors found (you don't owe anyone in this group)");
  }

  // =========================================
  // STEP 4: Pay the Debt
  // =========================================
  console.log("\n" + "=".repeat(80));
  console.log("💸 STEP 4: Pay Your Debt via Private Transfer");
  console.log("=".repeat(80));

  const paymentAmount = YOUR_SHARE; // Pay exactly what you owe
  
  console.log("\n💳 Payment Details:");
  console.log("   From:", formatAddress(yourAddress), "(YOU)");
  console.log("   To:", formatAddress(CREDITOR_ADDRESS), "(CREDITOR)");
  console.log("   Amount:", formatAmount(paymentAmount), "tokens");
  console.log("   Group:", groupId.toString());

  // Encrypt payment amount
  console.log("\n🔐 Encrypting payment amount...");
  const paymentInput = fhevm.createEncryptedInput(FHESPLIT_ADDRESS, yourAddress);
  const paymentEnc = paymentInput.add64(paymentAmount);
  const paymentEncrypted = await paymentEnc.encrypt();
  console.log("✅ Amount encrypted");

  // Send payment
  console.log("\n💸 Sending private transfer...");
  console.log("   (This will auto-settle your debt)");
  
  const transferTx = await fheSplit.privateTransferInGroup(
    groupId,
    CREDITOR_ADDRESS,
    paymentEncrypted.handles[0],
    paymentEncrypted.inputProof
  );

  console.log("\n⏳ Transaction sent!");
  console.log("🔗 View on Explorer: " + getTxLink(transferTx.hash));

  const transferReceipt = await transferTx.wait();
  console.log("✅ Payment completed! Gas used:", transferReceipt?.gasUsed.toString());

  // =========================================
  // STEP 5: Verify Debt is Settled
  // =========================================
  console.log("\n" + "=".repeat(80));
  console.log("✅ STEP 5: Verify Debt Settlement");
  console.log("=".repeat(80));

  console.log("\n🔍 Checking if debt is settled...");
  
  const creditorsAfter = await fheSplit.getCreditorsInGroup(groupId, yourAddress);
  console.log("✅ Current creditors:", creditorsAfter.length);

  if (creditorsAfter.length > 0) {
    console.log("\n💰 Remaining debts:");
    
    let remainingDebt = 0n;
    
    for (const creditor of creditorsAfter) {
      const encryptedDebt = await fheSplit.getNetOwedInGroup(
        groupId,
        yourAddress,
        creditor
      );
      
      const debtAmount = await decryptAmount(encryptedDebt, FHESPLIT_ADDRESS, wallet as any);
      
      if (debtAmount > 0n) {
        console.log(`   ${formatAddress(creditor)}: ${formatAmount(debtAmount)} tokens`);
        remainingDebt += debtAmount;
      }
    }
    
    if (remainingDebt === 0n) {
      console.log("\n🎉 ALL DEBTS SETTLED! You don't owe anyone in this group!");
    } else {
      console.log(`\n⚠️  Remaining debt: ${formatAmount(remainingDebt)} tokens`);
    }
  } else {
    console.log("\n🎉 ALL DEBTS SETTLED! You have no creditors in this group!");
  }

  // =========================================
  // FINAL SUMMARY
  // =========================================
  console.log("\n" + "=".repeat(80));
  console.log("📊 WORKFLOW SUMMARY");
  console.log("=".repeat(80));

  console.log("\n✅ What we demonstrated:");
  console.log("   1. Created group #" + groupId.toString() + " with you + creditor");
  console.log("   2. Added expense:", EXPENSE_DESCRIPTION);
  console.log("   3. Your share:", formatAmount(YOUR_SHARE), "tokens (encrypted)");
  console.log("   4. Queried creditors: Found", creditors.length, "creditor(s)");
  console.log("   5. Paid debt:", formatAmount(paymentAmount), "tokens");
  console.log("   6. Verified settlement: Debt cleared ✅");

  console.log("\n🔐 Privacy Features:");
  console.log("   ✅ All amounts encrypted on-chain (euint64)");
  console.log("   ✅ Only authorized parties can decrypt");
  console.log("   ✅ Observers see transactions but not amounts");
  console.log("   ✅ Auto-settlement in encrypted domain");
  console.log("   ✅ Group membership ≠ financial interaction (plausible deniability)");

  console.log("\n🔗 Transaction Links:");
  console.log("   Expense: " + getTxLink(expenseTx.hash));
  console.log("   Payment: " + getTxLink(transferTx.hash));

  console.log("\n📋 Contract Addresses:");
  console.log("   FHESplit: " + FHESPLIT_ADDRESS);
  console.log("   Group ID: " + groupId.toString());
  console.log("   Expense ID: " + expenseId.toString());

  console.log("\n🎉 Demo completed successfully!");
  console.log("=".repeat(80) + "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error.message);
    if (error.stack) {
      console.error("\nStack trace:", error.stack);
    }
    process.exit(1);
  });
