import { Search } from "lucide-react";
import type { DropdownState } from "./useDropdown";

export interface SearchFieldProps {
    dropdown: DropdownState;
    placeholder?: string;
    className?: string;
}

/** Filter box shown above the list when `dropdown.showSearch` is true. */
export function SearchField({
    dropdown,
    placeholder = "Search",
    className = "",
}: SearchFieldProps) {
    const { ref, ...inputProps } = dropdown.getSearchProps();
    return (
        <div className={`relative min-w-0 flex-1 ${className}`}>
            <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--text-muted)"
                strokeWidth={2.5}
                aria-hidden="true"
            />
            <input
                ref={ref}
                {...inputProps}
                placeholder={placeholder}
                className="min-h-11 w-full rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) py-2 pl-9 pr-3 text-base font-semibold text-(--text-ink) placeholder:text-(--text-muted) focus:bg-(--bg-card) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac) sm:text-sm"
            />
        </div>
    );
}
