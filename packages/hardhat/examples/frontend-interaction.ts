/**
 * FHESplit Frontend Interaction Examples
 *
 * This file demonstrates how to interact with FHESplit contracts from a frontend application
 * using ethers.js and the Zama fhevm SDK.
 *
 * Prerequisites:
 * - npm install ethers
 * - npm install @fhevm/solidity
 * - npm install @zama-fhe/fhevmjs
 */

import { ethers, BrowserProvider, Contract } from "ethers";
import { createInstance, FhevmInstance } from "@zama-fhe/fhevmjs";

// ========================================
// Type Definitions
// ========================================

interface ContractAddresses {
  mockToken: string;
  cToken: string;
  fheSplit: string;
}

interface User {
  address: string;
  signer: any;
}

// ========================================
// 1. Setup and Connection
// ========================================

/**
 * Connect to MetaMask and get the user's signer
 */
async function connectWallet(): Promise<User> {
  if (!window.ethereum) {
    throw new Error("MetaMask not installed");
  }

  const provider = new BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();

  console.log("Connected wallet:", address);
  return { address, signer };
}

/**
 * Initialize FHEVM instance for encryption
 */
async function initFHEVM(contractAddress: string, provider: any): Promise<FhevmInstance> {
  const fhevmInstance = await createInstance({
    kmsContractAddress: contractAddress, // KMS contract address on the network
    aclContractAddress: contractAddress, // ACL contract address
    network: await provider.getNetwork(),
    gatewayUrl: "https://gateway.sepolia.zama.ai", // Update for your network
  });

  console.log("FHEVM instance initialized");
  return fhevmInstance;
}

/**
 * Get contract instances
 */
function getContracts(addresses: ContractAddresses, signer: any) {
  // ABI fragments (import full ABIs in production)
  const mockTokenABI = [
    "function mint(address to, uint256 amount) external",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address owner) external view returns (uint256)",
  ];

  const cTokenABI = [
    "function underlying() external view returns (address)",
    "function wrap(address to, uint256 amount) external",
    "function unwrap(bytes memory encryptedAmount, bytes memory inputProof) external",
    "function setOperator(address operator, uint48 until) external",
    "function isOperator(address owner, address operator) external view returns (bool)",
    "function balanceOf(address user) external view returns (uint256)",
  ];

  const fheSplitABI = [
    "function confidentialToken() external view returns (address)",
    "function xmtpBotAddress() external view returns (address)",
    "function deposit(bytes memory encryptedAmount, bytes memory inputProof) external",
    "function withdraw(bytes memory encryptedAmount, bytes memory inputProof) external",
    "function withdrawAll() external",
    "function getPlatformBalance(address user) external view returns (uint256)",
    "function getUserGroups(address user) external view returns (uint256[])",
    "function getGroup(uint256 groupId) external view returns (tuple(uint256 id, string name, address creator, uint256 createdAt, bool exists))",
    "function getGroupMembers(uint256 groupId) external view returns (address[])",
    "function getNetOwedInGroup(uint256 groupId, address debtor, address creditor) external view returns (uint256)",
    "function getCreditorsInGroup(uint256 groupId, address user) external view returns (address[])",
    "function getDebtorsInGroup(uint256 groupId, address user) external view returns (address[])",
    "function privateTransferInGroup(uint256 groupId, address to, bytes memory encryptedAmount, bytes memory inputProof) external",
    "function getExpenseShare(uint256 expenseId, address member) external view returns (uint256)",
    "function getGroupExpenses(uint256 groupId) external view returns (uint256[])",
    "function getExpense(uint256 expenseId) external view returns (tuple(uint256 id, uint256 groupId, address payer, string description, uint256 createdAt, bool exists))",
  ];

  return {
    mockToken: new Contract(addresses.mockToken, mockTokenABI, signer),
    cToken: new Contract(addresses.cToken, cTokenABI, signer),
    fheSplit: new Contract(addresses.fheSplit, fheSplitABI, signer),
  };
}

// ========================================
// 2. Token Operations
// ========================================

/**
 * Mint test tokens (only for testing with MockERC20)
 */
async function mintTokens(mockToken: Contract, amount: string) {
  console.log(`Minting ${amount} tokens...`);
  const decimals = 6;
  const amountWei = ethers.parseUnits(amount, decimals);
  const tx = await mockToken.mint(await mockToken.runner.getAddress(), amountWei);
  await tx.wait();
  console.log("✅ Tokens minted:", tx.hash);
}

/**
 * Wrap ERC20 tokens to cToken
 */
async function wrapTokens(mockToken: Contract, cToken: Contract, amount: string) {
  console.log(`Wrapping ${amount} tokens...`);
  const decimals = 6;
  const amountWei = ethers.parseUnits(amount, decimals);

  // Approve cToken to spend tokens
  const approveTx = await mockToken.approve(await cToken.getAddress(), amountWei);
  await approveTx.wait();
  console.log("✅ Approved:", approveTx.hash);

  // Wrap tokens
  const userAddress = await mockToken.runner.getAddress();
  const wrapTx = await cToken.wrap(userAddress, amountWei);
  await wrapTx.wait();
  console.log("✅ Wrapped:", wrapTx.hash);
}

/**
 * Unwrap cToken back to ERC20
 */
async function unwrapTokens(cToken: Contract, fhevmInstance: FhevmInstance, amount: string) {
  console.log(`Unwrapping ${amount} tokens...`);
  const amountRaw = BigInt(parseFloat(amount) * 1_000_000); // 6 decimals

  // Encrypt the amount
  const userAddress = await cToken.runner.getAddress();
  const input = fhevmInstance.createEncryptedInput(await cToken.getAddress(), userAddress);
  input.add64(amountRaw);
  const encryptedInput = await input.encrypt();

  // Unwrap
  const unwrapTx = await cToken.unwrap(
    encryptedInput.handles[0],
    encryptedInput.inputProof
  );
  await unwrapTx.wait();
  console.log("✅ Unwrapped:", unwrapTx.hash);
}

// ========================================
// 3. Platform Operations
// ========================================

/**
 * Approve FHESplit as operator for cToken transfers
 */
async function approvePlatform(cToken: Contract, fheSplitAddress: string) {
  console.log("Approving FHESplit as operator...");
  const until = Math.floor(Date.now() / 1000) + 86400 * 365; // 1 year
  const tx = await cToken.setOperator(fheSplitAddress, until);
  await tx.wait();
  console.log("✅ FHESplit approved:", tx.hash);
}

/**
 * Deposit tokens to FHESplit platform
 */
async function depositToPlatform(fheSplit: Contract, fhevmInstance: FhevmInstance, amount: string) {
  console.log(`Depositing ${amount} tokens to platform...`);
  const amountRaw = BigInt(parseFloat(amount) * 1_000_000);

  // Encrypt the amount
  const userAddress = await fheSplit.runner.getAddress();
  const input = fhevmInstance.createEncryptedInput(await fheSplit.getAddress(), userAddress);
  input.add64(amountRaw);
  const encryptedInput = await input.encrypt();

  // Deposit
  const depositTx = await fheSplit.deposit(
    encryptedInput.handles[0],
    encryptedInput.inputProof
  );
  await depositTx.wait();
  console.log("✅ Deposited:", depositTx.hash);
}

/**
 * Withdraw tokens from FHESplit platform
 */
async function withdrawFromPlatform(fheSplit: Contract, fhevmInstance: FhevmInstance, amount: string) {
  console.log(`Withdrawing ${amount} tokens from platform...`);
  const amountRaw = BigInt(parseFloat(amount) * 1_000_000);

  // Encrypt the amount
  const userAddress = await fheSplit.runner.getAddress();
  const input = fhevmInstance.createEncryptedInput(await fheSplit.getAddress(), userAddress);
  input.add64(amountRaw);
  const encryptedInput = await input.encrypt();

  // Withdraw
  const withdrawTx = await fheSplit.withdraw(
    encryptedInput.handles[0],
    encryptedInput.inputProof
  );
  await withdrawTx.wait();
  console.log("✅ Withdrawn:", withdrawTx.hash);
}

/**
 * Get and decrypt platform balance
 */
async function getPlatformBalance(fheSplit: Contract, fhevmInstance: FhevmInstance, userAddress: string) {
  console.log("Getting platform balance...");

  // Get encrypted balance
  const encryptedBalance = await fheSplit.getPlatformBalance(userAddress);
  console.log("Encrypted balance handle:", encryptedBalance);

  // Decrypt (requires user signature)
  try {
    const decryptedBalance = await fhevmInstance.decrypt(
      await fheSplit.getAddress(),
      encryptedBalance
    );
    const balance = (Number(decryptedBalance) / 1_000_000).toFixed(2);
    console.log("✅ Platform balance:", balance, "tokens");
    return balance;
  } catch (error) {
    console.log("⚠️ Could not decrypt balance");
    return null;
  }
}

// ========================================
// 4. Group Operations
// ========================================

/**
 * Get user's groups
 */
async function getUserGroups(fheSplit: Contract, userAddress: string) {
  console.log("Getting user groups...");
  const groupIds = await fheSplit.getUserGroups(userAddress);
  console.log(`Found ${groupIds.length} groups:`, groupIds.map(id => id.toString()));

  const groups = [];
  for (const groupId of groupIds) {
    const group = await fheSplit.getGroup(groupId);
    groups.push({
      id: groupId.toString(),
      name: group.name,
      creator: group.creator,
      createdAt: new Date(Number(group.createdAt) * 1000),
    });
  }

  return groups;
}

/**
 * Get group members
 */
async function getGroupMembers(fheSplit: Contract, groupId: string) {
  console.log(`Getting members of group ${groupId}...`);
  const members = await fheSplit.getGroupMembers(groupId);
  console.log(`Group has ${members.length} members:`, members);
  return members;
}

/**
 * Get group expenses
 */
async function getGroupExpenses(fheSplit: Contract, groupId: string) {
  console.log(`Getting expenses for group ${groupId}...`);
  const expenseIds = await fheSplit.getGroupExpenses(groupId);
  console.log(`Found ${expenseIds.length} expenses`);

  const expenses = [];
  for (const expenseId of expenseIds) {
    const expense = await fheSplit.getExpense(expenseId);
    expenses.push({
      id: expenseId.toString(),
      description: expense.description,
      payer: expense.payer,
      createdAt: new Date(Number(expense.createdAt) * 1000),
    });
  }

  return expenses;
}

// ========================================
// 5. Debt Management
// ========================================

/**
 * Get who you owe in a group
 */
async function getCreditors(fheSplit: Contract, groupId: string, userAddress: string) {
  console.log(`Getting creditors for user in group ${groupId}...`);
  const creditors = await fheSplit.getCreditorsInGroup(groupId, userAddress);
  console.log("You owe:", creditors);
  return creditors;
}

/**
 * Get who owes you in a group
 */
async function getDebtors(fheSplit: Contract, groupId: string, userAddress: string) {
  console.log(`Getting debtors for user in group ${groupId}...`);
  const debtors = await fheSplit.getDebtorsInGroup(groupId, userAddress);
  console.log("Owes you:", debtors);
  return debtors;
}

/**
 * Get encrypted debt amount between two users
 */
async function getDebtAmount(
  fheSplit: Contract,
  fhevmInstance: FhevmInstance,
  groupId: string,
  debtor: string,
  creditor: string
) {
  console.log(`Getting debt from ${debtor} to ${creditor}...`);

  const encryptedDebt = await fheSplit.getNetOwedInGroup(groupId, debtor, creditor);
  console.log("Encrypted debt handle:", encryptedDebt);

  try {
    const decryptedDebt = await fhevmInstance.decrypt(
      await fheSplit.getAddress(),
      encryptedDebt
    );
    const debt = (Number(decryptedDebt) / 1_000_000).toFixed(2);
    console.log("✅ Debt amount:", debt, "tokens");
    return debt;
  } catch (error) {
    console.log("⚠️ Could not decrypt debt");
    return null;
  }
}

// ========================================
// 6. Transfers
// ========================================

/**
 * Transfer with auto-settlement within a group
 */
async function transferInGroup(
  fheSplit: Contract,
  fhevmInstance: FhevmInstance,
  groupId: string,
  recipientAddress: string,
  amount: string
) {
  console.log(`Transferring ${amount} tokens to ${recipientAddress} in group ${groupId}...`);
  const amountRaw = BigInt(parseFloat(amount) * 1_000_000);

  // Encrypt the amount
  const userAddress = await fheSplit.runner.getAddress();
  const input = fhevmInstance.createEncryptedInput(await fheSplit.getAddress(), userAddress);
  input.add64(amountRaw);
  const encryptedInput = await input.encrypt();

  // Transfer (will auto-settle debts)
  const transferTx = await fheSplit.privateTransferInGroup(
    groupId,
    recipientAddress,
    encryptedInput.handles[0],
    encryptedInput.inputProof
  );
  await transferTx.wait();
  console.log("✅ Transfer complete (debts auto-settled):", transferTx.hash);
}

// ========================================
// 7. React/Vue Component Example
// ========================================

/**
 * Example React component for displaying user's groups and balances
 */
/*
import React, { useState, useEffect } from 'react';

function FHESplitDashboard({ addresses, fhevmInstance }) {
  const [user, setUser] = useState(null);
  const [contracts, setContracts] = useState(null);
  const [groups, setGroups] = useState([]);
  const [balance, setBalance] = useState(null);

  useEffect(() => {
    async function init() {
      const connectedUser = await connectWallet();
      setUser(connectedUser);

      const contractInstances = getContracts(addresses, connectedUser.signer);
      setContracts(contractInstances);

      // Load groups
      const userGroups = await getUserGroups(contractInstances.fheSplit, connectedUser.address);
      setGroups(userGroups);

      // Load balance
      const bal = await getPlatformBalance(
        contractInstances.fheSplit,
        fhevmInstance,
        connectedUser.address
      );
      setBalance(bal);
    }
    init();
  }, []);

  return (
    <div>
      <h1>FHESplit Dashboard</h1>
      <p>Connected: {user?.address}</p>
      <p>Platform Balance: {balance} tokens</p>

      <h2>Your Groups</h2>
      {groups.map(group => (
        <div key={group.id}>
          <h3>{group.name}</h3>
          <p>ID: {group.id}</p>
          <p>Created: {group.createdAt.toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
}
*/

// ========================================
// 8. Complete Workflow Example
// ========================================

async function completeWorkflowExample() {
  console.log("🚀 Starting complete workflow example...\n");

  // Setup
  const user = await connectWallet();
  const addresses: ContractAddresses = {
    mockToken: "0x...", // Replace with deployed addresses
    cToken: "0x...",
    fheSplit: "0x...",
  };

  const contracts = getContracts(addresses, user.signer);
  const fhevmInstance = await initFHEVM(addresses.fheSplit, user.signer.provider);

  // Step 1: Mint and wrap tokens
  await mintTokens(contracts.mockToken, "1000");
  await wrapTokens(contracts.mockToken, contracts.cToken, "500");

  // Step 2: Approve and deposit to platform
  await approvePlatform(contracts.cToken, addresses.fheSplit);
  await depositToPlatform(contracts.fheSplit, fhevmInstance, "300");

  // Step 3: Check balance
  await getPlatformBalance(contracts.fheSplit, fhevmInstance, user.address);

  // Step 4: View groups and expenses
  const groups = await getUserGroups(contracts.fheSplit, user.address);
  if (groups.length > 0) {
    const groupId = groups[0].id;
    await getGroupMembers(contracts.fheSplit, groupId);
    await getGroupExpenses(contracts.fheSplit, groupId);

    // Step 5: View debts
    await getCreditors(contracts.fheSplit, groupId, user.address);
    await getDebtors(contracts.fheSplit, groupId, user.address);

    // Step 6: Make a transfer
    // await transferInGroup(contracts.fheSplit, fhevmInstance, groupId, recipientAddress, "50");
  }

  console.log("\n✅ Workflow complete!");
}

// Export functions for use in frontend
export {
  connectWallet,
  initFHEVM,
  getContracts,
  mintTokens,
  wrapTokens,
  unwrapTokens,
  approvePlatform,
  depositToPlatform,
  withdrawFromPlatform,
  getPlatformBalance,
  getUserGroups,
  getGroupMembers,
  getGroupExpenses,
  getCreditors,
  getDebtors,
  getDebtAmount,
  transferInGroup,
};
