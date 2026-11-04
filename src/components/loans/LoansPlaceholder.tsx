import { BubbyConstruction, EmptyStateCard } from "../ui";

/** Placeholder shown on the Plan > Loans tab while loans are rebuilt. */
export function LoansPlaceholder() {
    return (
        <EmptyStateCard
            illustration={<BubbyConstruction className="h-44 w-auto mx-auto" />}
            title="Under Construction"
            description="Bubby is building something for your loans."
        />
    );
}

export default LoansPlaceholder;
