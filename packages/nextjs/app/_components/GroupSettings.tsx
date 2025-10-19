"use client";

import { useMemo, useState } from "react";
import { GroupHeader } from "./GroupHeader";
import { GroupMembersList } from "./GroupMembersList";
import ModalButton from "./ModalButton";
import type { GroupMember } from "./types";
import { useFhevm } from "@fhevm-sdk";
import { useAccount } from "wagmi";
import { useFHESplitWagmi } from "~~/hooks/fhesplit/useFHESplitWagmi";

export const GroupSettings = () => {
  const { address: userAddress, isConnected, chain } = useAccount();
  const chainId = chain?.id;

  // FHEVM instance setup
  const provider = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    return (window as any).ethereum;
  }, []);

  const initialMockChains = { 31337: "http://localhost:8545" };

  const { instance: fhevmInstance } = useFhevm({
    provider,
    chainId,
    initialMockChains,
    enabled: true,
  });

  // Mock group ID - replace with actual group ID from props or route
  const groupId = 2;

  // FHESplit hook
  const fheSplit = useFHESplitWagmi({
    instance: fhevmInstance,
    initialMockChains,
    groupId: groupId,
  });

  // Add member modal state
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [newMemberAddress, setNewMemberAddress] = useState("");

  // Add expense state
  const [expenseDescription, setExpenseDescription] = useState("");
  const [expensePayer, setExpensePayer] = useState("");
  const [addresses, setAddresses] = useState("");
  const [shares, setShares] = useState("");

  // No state needed for simple test transaction

  // Mock members for UI - in production, fetch from contract
  const [members, setMembers] = useState<GroupMember[]>([
    {
      id: "1",
      name: "Sarah Johnson",
      address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
      balance: 24.5,
    },
    {
      id: "2",
      name: "Mike Chen",
      address: "0xd4de553ABD6D11d9707CcB6Cc8d520D55010DdCC",
      balance: -15.75,
    },
    {
      id: "3",
      name: "Alex Rivera",
      address: "0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2",
      balance: -8.25,
    },
    {
      id: "you",
      name: "You",
      address: userAddress ?? "",
      balance: 0,
      isCurrentUser: true,
      isOwner: true,
    },
  ]);

  const handleRemoveMember = async (id: string) => {
    // Find member by id
    const member = members.find(m => m.id === id);
    if (!member) return;

    // In production, use actual member address from contract data
    // For now, using mock addresses
    const addressMap: Record<string, string> = {
      "1": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
      "2": "0x5B38Da6a701c568545dCfcB03FcB875f56beddC4",
      "3": "0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2",
    };

    const memberAddress = addressMap[id];
    if (!memberAddress) {
      console.error("Member address not found");
      return;
    }

    // Call contract to remove member
    const success = await fheSplit.removeMember(memberAddress);
    if (success) {
      // Update local state
      setMembers(members.filter(m => m.id !== id));
    }
  };

  const handleAddMembers = () => {
    setIsAddMemberModalOpen(true);
  };

  const handleConfirmAddMember = async () => {
    if (!newMemberAddress) return;

    // Call contract to add member
    const success = await fheSplit.addMember(newMemberAddress);
    if (success) {
      // In production, fetch updated member list from contract
      // For now, add to local state
      const newMember: GroupMember = {
        id: Date.now().toString(),
        name: `${newMemberAddress.slice(0, 6)}...${newMemberAddress.slice(-4)}`,
        balance: 0,
        address: newMemberAddress,
      };
      setMembers([...members, newMember]);

      // Close modal and reset
      setIsAddMemberModalOpen(false);
      setNewMemberAddress("");
    }
  };

  const handleCancelAddMember = () => {
    setIsAddMemberModalOpen(false);
    setNewMemberAddress("");
  };

  const handleInviteViaLink = () => {
    console.log("Invite via link clicked");
    // Implement invite via link logic
  };

  const handlePayDebt = async (creditor: string) => {
    await fheSplit.payDebt(creditor, BigInt(1000000000000000)); // 0.001 ETH
  };

  const handleAddExpense = async () => {
    const memberAddresses = addresses
      .split(",")
      .map(a => a.trim())
      .filter(Boolean);

    const shareValues = shares
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    if (memberAddresses.length !== shareValues.length) {
      alert(`Number of addresses (${memberAddresses.length}) must match number of shares (${shareValues.length})`);
      return;
    }

    const memberShares = shareValues.map(s => {
      const value = parseFloat(s);
      if (isNaN(value)) {
        throw new Error(`Invalid share value: ${s}`);
      }
      return BigInt(Math.floor(value * 1e18));
    });

    console.log("Addresses:", memberAddresses);
    console.log("Shares (ETH):", shareValues);
    console.log("Shares (wei):", memberShares);

    const success = await fheSplit.addExpense({
      payer: expensePayer,
      members: memberAddresses,
      shares: memberShares,
      description: expenseDescription,
    });

    if (success) {
      setExpenseDescription("");
      setExpensePayer("");
      setAddresses("");
      setShares("");
    }
  };

  return (
    <div className="min-h-screen bg-base-300 text-white">
      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <GroupHeader
          name={fheSplit.groupInfo?.name ?? "Group"}
          createdDate={new Date(Number(fheSplit.groupInfo?.createdAt) * 1000).toLocaleDateString()}
        />

        {/* Status Messages */}
        {fheSplit.message && (
          <div className="bg-base-200 rounded-xl p-4">
            <p className="text-sm">{fheSplit.message}</p>
          </div>
        )}

        {/* FHEVM Status (for debugging) */}
        {!isConnected && (
          <div className="bg-yellow-900/20 border border-yellow-700 rounded-xl p-4">
            <p className="text-yellow-400">⚠️ Wallet not connected. Connect to manage members.</p>
          </div>
        )}

        <ModalButton title="Add Expense">
          <h3 className="text-xl font-bold mb-4">Add Expense</h3>
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Description"
              value={expenseDescription}
              onChange={e => setExpenseDescription(e.target.value)}
              className="w-full px-4 py-2 bg-base-300 rounded-lg"
            />
            <input
              type="text"
              placeholder="Payer address"
              value={expensePayer}
              onChange={e => setExpensePayer(e.target.value)}
              className="w-full px-4 py-2 bg-base-300 rounded-lg"
            />
            <input
              type="text"
              placeholder="Addresses (comma-separated)"
              value={addresses}
              onChange={e => setAddresses(e.target.value)}
              className="w-full px-4 py-2 bg-base-300 rounded-lg"
            />
            <input
              type="text"
              placeholder="Shares in ETH (comma-separated)"
              value={shares}
              onChange={e => setShares(e.target.value)}
              className="w-full px-4 py-2 bg-base-300 rounded-lg"
            />
            <button onClick={handleAddExpense} className="w-full btn btn-primary">
              Add Expense
            </button>
          </div>
        </ModalButton>

        {fheSplit.isLoadingExpenses ? (
          <div className="text-center py-8">Loading expenses...</div>
        ) : (
          <div>
            <h3 className="text-lg font-semibold mb-4">Expenses ({fheSplit.expenses.length})</h3>
            <div className="space-y-3">
              {fheSplit.expenses.map((expense: any, index: number) => (
                <div key={index} className="bg-base-200 rounded-xl p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold">{expense.description}</h4>
                      <p className="text-sm text-base-content/70">
                        Payer: {expense.payer.slice(0, 6)}...{expense.payer.slice(-4)}
                      </p>
                      <p className="text-xs text-base-content/50">
                        {new Date(Number(expense.createdAt) * 1000).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-base-content/50">ID: {expense.id.toString()}</p>
                    </div>
                  </div>
                </div>
              ))}
              {fheSplit.expenses.length === 0 && (
                <div className="text-center py-8 text-base-content/50">No expenses yet</div>
              )}
            </div>
          </div>
        )}

        {/* My Debts Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">My Debts</h3>
          <div className="space-y-3">
            {(fheSplit.groupMembers.length > 0 ? fheSplit.groupMembers : members.map(m => m.address).filter(Boolean))
              .filter((member: string) => member.toLowerCase() !== userAddress?.toLowerCase())
              .map((creditor: string) => {
                const debtAmountEth = 0.001;
                return (
                  <div key={creditor} className="bg-base-200 rounded-xl p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="text-sm text-base-content/70 mb-1">You owe</p>
                        <p className="font-semibold">
                          {creditor.slice(0, 6)}...{creditor.slice(-4)}
                        </p>
                        <p className="text-base-content/50">{debtAmountEth} ETH</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => handlePayDebt(creditor)}
                          disabled={fheSplit.isProcessing}
                          className="btn btn-sm btn-primary"
                        >
                          Pay
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            {(fheSplit.groupMembers.length > 0
              ? fheSplit.groupMembers
              : members.map(m => m.address).filter(Boolean)
            ).filter((member: string) => member.toLowerCase() !== userAddress?.toLowerCase()).length === 0 && (
              <div className="bg-base-200 rounded-xl p-8 text-center">
                <p className="text-base-content/50">No other members in the group</p>
              </div>
            )}
          </div>
        </div>

        <GroupMembersList
          members={members}
          onRemoveMember={handleRemoveMember}
          onAddMembers={handleAddMembers}
          onInviteViaLink={handleInviteViaLink}
        />
      </div>

      {/* Add Member Modal */}
      {isAddMemberModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-base-200 rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4">Add Group Member</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Member Address</label>
                <input
                  type="text"
                  value={newMemberAddress}
                  onChange={e => setNewMemberAddress(e.target.value)}
                  placeholder="0x..."
                  className="w-full px-4 py-2 bg-base-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  disabled={fheSplit.isProcessing}
                />
                <p className="text-xs text-base-content/50 mt-1">Enter the Ethereum address of the member to add</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleConfirmAddMember}
                  disabled={!newMemberAddress || fheSplit.isProcessing || !fheSplit.canManageMembers}
                  className="flex-1 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors duration-200"
                >
                  {fheSplit.isProcessing ? "Adding..." : "Add Member"}
                </button>
                <button
                  onClick={handleCancelAddMember}
                  disabled={fheSplit.isProcessing}
                  className="flex-1 py-2 px-4 bg-base-300 hover:bg-base-100 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors duration-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
