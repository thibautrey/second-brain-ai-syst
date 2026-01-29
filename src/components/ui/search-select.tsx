import { ChevronDown, Search, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

import { cn } from "../../lib/utils";

export interface SearchSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SearchSelectProps {
  options: SearchSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  maxHeight?: string;
}

export const SearchSelect = React.forwardRef<HTMLDivElement, SearchSelectProps>(
  (
    {
      options,
      value,
      onChange,
      placeholder = "Search or select...",
      disabled = false,
      className,
      maxHeight = "300px",
    },
    ref,
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchValue, setSearchValue] = useState("");
    const [filteredOptions, setFilteredOptions] = useState(options);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Update filtered options when options or search value changes
    useEffect(() => {
      const filtered = options.filter(
        (option) =>
          option.label.toLowerCase().includes(searchValue.toLowerCase()) ||
          option.value.toLowerCase().includes(searchValue.toLowerCase()),
      );
      setFilteredOptions(filtered);
    }, [searchValue, options]);

    // Verify selected option exists in current options
    const selectedOption = options.find((opt) => opt.value === value);

    // Close dropdown when clicking outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          containerRef.current &&
          !containerRef.current.contains(event.target as Node)
        ) {
          setIsOpen(false);
        }
      };

      if (isOpen) {
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
          document.removeEventListener("mousedown", handleClickOutside);
        };
      }
    }, [isOpen]);

    // Focus input when dropdown opens
    useEffect(() => {
      if (isOpen && inputRef.current) {
        inputRef.current.focus();
      }
    }, [isOpen]);

    const handleSelect = (optionValue: string) => {
      onChange(optionValue);
      setIsOpen(false);
      setSearchValue("");
    };

    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange("");
      setSearchValue("");
    };

    return (
      <div ref={containerRef} className={cn("relative w-full", className)}>
        {/* Main Input/Display */}
        <div
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2",
            "cursor-pointer hover:bg-slate-50",
            disabled && "cursor-not-allowed opacity-50",
            isOpen && "ring-2 ring-blue-600 ring-offset-2",
          )}
        >
          <div className="flex items-center flex-1 min-w-0 gap-2">
            <Search className="flex-shrink-0 w-4 h-4 text-slate-400" />
            {selectedOption ? (
              <span className="truncate text-slate-900">
                {selectedOption.label}
              </span>
            ) : (
              <span className="text-slate-500">{placeholder}</span>
            )}
          </div>
          <div className="flex items-center flex-shrink-0 gap-1">
            {selectedOption && !disabled && (
              <button
                onClick={handleClear}
                className="p-1 rounded hover:bg-slate-200"
                title="Clear selection"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            )}
            <ChevronDown
              className={cn(
                "h-4 w-4 text-slate-400 transition-transform",
                isOpen && "rotate-180",
              )}
            />
          </div>
        </div>

        {/* Dropdown Menu */}
        {isOpen && (
          <div
            className="absolute left-0 right-0 z-50 mt-2 bg-white border rounded-md shadow-lg top-full border-slate-200"
            style={{ maxHeight }}
          >
            {/* Search Input */}
            <div className="sticky top-0 p-2 bg-white border-b border-slate-200">
              <input
                ref={inputRef}
                type="text"
                placeholder={placeholder}
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className={cn(
                  "w-full h-9 px-3 py-2 text-sm rounded-md border border-slate-200 bg-white",
                  "focus:outline-none focus:ring-2 focus:ring-blue-600",
                )}
              />
            </div>

            {/* Options List */}
            <div
              className="overflow-y-auto"
              style={{ maxHeight: `calc(${maxHeight} - 50px)` }}
            >
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleSelect(option.value)}
                    disabled={option.disabled}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm hover:bg-blue-50",
                      "transition-colors",
                      value === option.value &&
                        "bg-blue-50 text-blue-900 font-medium",
                      option.disabled &&
                        "cursor-not-allowed opacity-50 hover:bg-white",
                    )}
                  >
                    {option.label}
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-sm text-slate-500">
                  No options found
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  },
);

SearchSelect.displayName = "SearchSelect";
