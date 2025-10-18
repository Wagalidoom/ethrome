"use client";

import { useMemo, useState } from "react";
import { GroupHeader } from "./GroupHeader";
import { GroupMembersList } from "./GroupMembersList";
import { ExpensesHistory } from "./ExpensesHistory";
import type { GroupMember, ExpenseWithShares } from "./types";
import { useFhevm } from "@fhevm-sdk";
import { useAccount } from "wagmi";
import { useFHESplitWagmi } from "~~/hooks/fhesplit/useFHESplitWagmi";

export const GroupSettings = () => {
  const { isConnected, chain } = useAccount();
  const chainId = chain?.id;

  // FHEVM instance setup
  const provider = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    return (window as any).ethereum;
  }, []);

  const initialMockChains = { 31337: "http://localhost:8545" };

  const {
    instance: fhevmInstance,
    status: fhevmStatus,
  } = useFhevm({
    provider,
    chainId,
    initialMockChains,
    enabled: true,
  });

  // Mock group ID - replace with actual group ID from props or route
  const groupId = 1;

  // FHESplit hook
  const fheSplit = useFHESplitWagmi({
    instance: fhevmInstance,
    initialMockChains,
    groupId: groupId,
  });

  // Add member modal state
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [newMemberAddress, setNewMemberAddress] = useState("");

  console.log(fheSplit.groupMembers);

  // Mock members for UI - in production, fetch from contract
  const [members, setMembers] = useState<GroupMember[]>([
    {
      id: "1",
      name: "Sarah Johnson",
      balance: 24.5,
    },
    {
      id: "2",
      name: "Mike Chen",
      balance: -15.75,
    },
    {
      id: "3",
      name: "Alex Rivera",
      balance: -8.25,
    },
    {
      id: "you",
      name: "You",
      balance: 0,
      isCurrentUser: true,
      isOwner: true,
    },
  ]);

  // Mock expenses that align with the smart contract structure
  const [expenses] = useState<ExpenseWithShares[]>([
    {
      id: "1",
      groupId: "1",
      payer: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
      payerName: "Sarah Johnson",
      description: "Hotel Booking",
      createdAt: Math.floor(new Date("2024-10-15").getTime() / 1000),
      exists: true,
      shares: [
        { member: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0", memberName: "Sarah Johnson", amount: BigInt(112.5e18) },
        { member: "0x5B38Da6a701c568545dCfcB03FcB875f56beddC4", memberName: "Mike Chen", amount: BigInt(112.5e18) },
        { member: "0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2", memberName: "Alex Rivera", amount: BigInt(112.5e18) },
        { member: "0x4B20993Bc481177ec7E8f571ceCaE8A9e22C02db", memberName: "You", amount: BigInt(112.5e18) },
      ],
      totalAmount: BigInt(450e18),
    },
    {
      id: "2",
      groupId: "1",
      payer: "0x4B20993Bc481177ec7E8f571ceCaE8A9e22C02db",
      payerName: "You",
      description: "Dinner at Italian Restaurant",
      createdAt: Math.floor(new Date("2024-10-16").getTime() / 1000),
      exists: true,
      shares: [
        { member: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0", memberName: "Sarah Johnson", amount: BigInt(40.17e18) },
        { member: "0x5B38Da6a701c568545dCfcB03FcB875f56beddC4", memberName: "Mike Chen", amount: BigInt(40.17e18) },
        { member: "0x4B20993Bc481177ec7E8f571ceCaE8A9e22C02db", memberName: "You", amount: BigInt(40.16e18) },
      ],
      totalAmount: BigInt(120.5e18),
    },
    {
      id: "3",
      groupId: "1",
      payer: "0x5B38Da6a701c568545dCfcB03FcB875f56beddC4",
      payerName: "Mike Chen",
      description: "Gas for Road Trip",
      createdAt: Math.floor(new Date("2024-10-16").getTime() / 1000),
      exists: true,
      shares: [
        { member: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0", memberName: "Sarah Johnson", amount: BigInt(21.25e18) },
        { member: "0x5B38Da6a701c568545dCfcB03FcB875f56beddC4", memberName: "Mike Chen", amount: BigInt(21.25e18) },
        { member: "0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2", memberName: "Alex Rivera", amount: BigInt(21.25e18) },
        { member: "0x4B20993Bc481177ec7E8f571ceCaE8A9e22C02db", memberName: "You", amount: BigInt(21.25e18) },
      ],
      totalAmount: BigInt(85e18),
    },
    {
      id: "4",
      groupId: "1",
      payer: "0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2",
      payerName: "Alex Rivera",
      description: "Grocery Shopping",
      createdAt: Math.floor(new Date("2024-10-17").getTime() / 1000),
      exists: true,
      shares: [
        { member: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0", memberName: "Sarah Johnson", amount: BigInt(16.81e18) },
        { member: "0x5B38Da6a701c568545dCfcB03FcB875f56beddC4", memberName: "Mike Chen", amount: BigInt(16.81e18) },
        { member: "0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2", memberName: "Alex Rivera", amount: BigInt(16.81e18) },
        { member: "0x4B20993Bc481177ec7E8f571ceCaE8A9e22C02db", memberName: "You", amount: BigInt(16.82e18) },
      ],
      totalAmount: BigInt(67.25e18),
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
      setMembers(members.filter((m) => m.id !== id));
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

  return (
    <div className="min-h-screen bg-base-300 text-white">
      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <GroupHeader name="Weekend Trip" createdDate="Oct 15, 2024" />

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

        <ExpensesHistory expenses={expenses} />

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
                <label className="block text-sm font-medium mb-2">
                  Member Address
                </label>
                <input
                  type="text"
                  value={newMemberAddress}
                  onChange={(e) => setNewMemberAddress(e.target.value)}
                  placeholder="0x..."
                  className="w-full px-4 py-2 bg-base-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  disabled={fheSplit.isProcessing}
                />
                <p className="text-xs text-base-content/50 mt-1">
                  Enter the Ethereum address of the member to add
                </p>
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
