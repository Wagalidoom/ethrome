"use client";

import { useState } from "react";
import { GroupHeader } from "./GroupHeader";
import { GroupMembersList } from "./GroupMembersList";
import { ExpensesHistory } from "./ExpensesHistory";
import type { GroupMember, ExpenseWithShares } from "./types";

export const GroupSettings = () => {
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

  const handleRemoveMember = (id: string) => {
    setMembers(members.filter((m) => m.id !== id));
  };

  const handleAddMembers = () => {
    console.log("Add members clicked");
    // Implement add members logic
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

        <ExpensesHistory expenses={expenses} />

        <GroupMembersList
          members={members}
          onRemoveMember={handleRemoveMember}
          onAddMembers={handleAddMembers}
          onInviteViaLink={handleInviteViaLink}
        />
      </div>
    </div>
  );
};
