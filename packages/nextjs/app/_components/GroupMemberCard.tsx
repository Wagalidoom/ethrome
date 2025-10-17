import { XMarkIcon } from "@heroicons/react/24/outline";
import type { GroupMember } from "./types";

interface GroupMemberCardProps {
  member: GroupMember;
  onRemove?: (id: string) => void;
}

export const GroupMemberCard = ({ member, onRemove }: GroupMemberCardProps) => {
  const getBalanceText = () => {
    if (member.isCurrentUser && member.balance === 0) {
      return <span className="text-white font-medium">settled up</span>;
    }
    if (!member.balance || member.balance === 0) return null;
    
    const amount = Math.abs(member.balance).toFixed(2);
    const isPositive = member.balance > 0;
    
    return (
      <span className={`font-semibold ${isPositive ? "text-green-400" : "text-red-400"}`}>
        {isPositive ? `gets back $${amount}` : `owes $${amount}`}
      </span>
    );
  };

  return (
    <div className={`
      flex items-center justify-between p-4 rounded-xl border border-base-content/10
      ${member.isCurrentUser 
        ? "bg-gradient-to-br from-indigo-900/50 to-purple-900/50 border-2 border-indigo-500/30" 
        : "bg-base-200"
      }
    `}>
      <div className="flex items-center gap-3 flex-1">
        <div className="relative">
          <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
            {member.avatar ? (
              <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
            ) : (
              <span className="font-bold text-lg">
                {member.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold truncate">
              {member.name}
            </h3>
            {member.isOwner && (
              <span className="px-2 py-0.5 text-xs font-medium bg-indigo-500 text-white rounded-full">
                Owner
              </span>
            )}
          </div>
          <div className="mt-1 text-sm">
            {getBalanceText()}
          </div>
        </div>
      </div>
      
      {!member.isCurrentUser && onRemove && (
        <button
          onClick={() => onRemove(member.id)}
          className="ml-2 p-1.5 hover:bg-red-500/20 rounded-lg transition-colors group"
          aria-label="Remove member"
        >
          <XMarkIcon className="w-5 h-5 text-slate-400 group-hover:text-red-400" />
        </button>
      )}
    </div>
  );
};

