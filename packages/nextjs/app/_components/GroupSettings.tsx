"use client";

import { useState } from "react";
import { GroupHeader } from "./GroupHeader";
import { GroupMembersList } from "./GroupMembersList";
import type { GroupMember } from "./types";

export const GroupSettings = () => {
  
  const [members, setMembers] = useState<GroupMember[]>([
    {
      id: "1",
      name: "Sarah Johnson",
      balance: 24.50,
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
      isAdmin: true,
    },
  ]);

  const handleRemoveMember = (id: string) => {
    setMembers(members.filter(m => m.id !== id));
  };

  const handleAddMembers = () => {
    console.log("Add members clicked");
    // Implement add members logic
  };

  const handleInviteViaLink = () => {
    console.log("Invite via link clicked");
    // Implement invite via link logic
  };

  const membersForDropdown = members.map(m => ({
    id: m.id,
    name: m.name,
  }));

  return (
    <div className="min-h-screen bg-base-300 text-white">

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <GroupHeader
          name="Weekend Trip"
          createdDate="Oct 15, 2024"
        />

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

