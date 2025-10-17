import type { GroupMember } from "./types";
import { LinkIcon, PlusIcon } from "@heroicons/react/24/outline";
import { GroupMemberCard } from "./GroupMemberCard";

interface GroupMembersListProps {
  members: GroupMember[];
  onRemoveMember?: (id: string) => void;
  onAddMembers?: () => void;
  onInviteViaLink?: () => void;
}

export const GroupMembersList = ({
  members,
  onRemoveMember,
  onAddMembers,
  onInviteViaLink,
}: GroupMembersListProps) => {
  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Group Members</h3>
        <span className="text-sm text-base-content/50">{members.length} members</span>
      </div>

      <div className="space-y-3">
        {members.map((member) => (
          <GroupMemberCard key={member.id} member={member} onRemove={onRemoveMember} />
        ))}
      </div>

      <div className="space-y-2 pt-2">
        <button
          onClick={onAddMembers}
          className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors duration-200 flex items-center justify-center gap-2 shadow-lg"
        >
          <PlusIcon className="w-5 h-5" />
          Add Members
        </button>

        <button
          onClick={onInviteViaLink}
          className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl transition-colors duration-200 flex items-center justify-center gap-2"
        >
          <LinkIcon className="w-5 h-5" />
          Invite via Link
        </button>
      </div>
    </div>
  );
};
