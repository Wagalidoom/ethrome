import { UsersIcon } from "@heroicons/react/24/solid";

interface GroupHeaderProps {
  name: string;
  createdDate: string;
}

export const GroupHeader = ({ name, createdDate }: GroupHeaderProps) => {
  return (
    <div className="flex items-center gap-4 p-4 bg-base-200 rounded-xl border border-base-content/10">
      <div className="flex items-center justify-center rounded-full">
        <UsersIcon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-lg font-bold">{name}</p>
        <p className="text-sm text-base-content/50">Created on {createdDate}</p>
      </div>
    </div>
  );
};

