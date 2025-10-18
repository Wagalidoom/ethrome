import type { ExpenseWithShares } from "./types";
import { CalendarIcon, UserIcon } from "@heroicons/react/24/outline";

interface ExpensesHistoryProps {
    expenses: ExpenseWithShares[];
}

export const ExpensesHistory = ({ expenses }: ExpensesHistoryProps) => {
    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp * 1000);
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    };

    const formatAmount = (amount: bigint | number) => {
        const amountInEther = typeof amount === 'bigint' ? Number(amount) / 1e18 : amount;
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
        }).format(amountInEther);
    };

    const formatAddress = (address: string) => {
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Expenses History</h3>
                <span className="text-sm text-base-content/50">{expenses.length} expenses</span>
            </div>

            {expenses.length === 0 ? (
                <div className="bg-base-200 rounded-xl p-8 text-center">
                    <p className="text-base-content/50">No expenses yet. Add your first expense to get started!</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {expenses.map((expense) => (
                        <div
                            key={expense.id}
                            className="bg-base-200 rounded-xl p-4 hover:bg-base-100 transition-colors duration-200"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className="font-semibold text-base">{expense.description}</h4>
                                    </div>

                                    <div className="flex flex-col gap-1.5 text-sm text-base-content/70">
                                        <div className="flex items-center gap-1.5">
                                            <UserIcon className="w-4 h-4" />
                                            <span>
                                                Paid by{" "}
                                                <span className="font-medium text-base-content">
                                                    {expense.payerName || formatAddress(expense.payer)}
                                                </span>
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-1.5">
                                            <CalendarIcon className="w-4 h-4" />
                                            <span>{formatDate(expense.createdAt)}</span>
                                        </div>

                                        <div className="text-xs">
                                            Split between: {expense.shares.length} {expense.shares.length === 1 ? "person" : "people"}
                                        </div>
                                    </div>
                                </div>

                                <div className="text-right ml-4">

                                    <div className="text-xl font-bold text-indigo-400">
                                        {formatAmount(expense.totalAmount)}
                                    </div>
                                    <div className="text-xs text-base-content/50 mt-1">
                                        {formatAmount(expense.totalAmount / BigInt(expense.shares.length))} per person
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

