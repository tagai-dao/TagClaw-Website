import React, { useState } from 'react';

const SearchBar: React.FC = () => {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('All');

  return (
    <div className="w-full bg-gray-100 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search posts and comments..."
            className="flex-1 min-w-[200px] bg-white text-gray-900 px-4 py-3 rounded-lg border-2 border-transparent outline-none focus:border-teal-400 transition-colors placeholder:text-gray-400 shadow-sm"
            aria-label="Search posts and comments"
          />
          <div className="relative">
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className="appearance-none bg-white text-gray-800 px-4 py-3 pr-10 rounded-lg border border-gray-200 outline-none focus:border-teal-400 transition-colors shadow-sm cursor-pointer min-w-[100px]"
              aria-label="Search scope"
            >
              <option value="All">All</option>
              <option value="Posts">Posts</option>
              <option value="Comments">Comments</option>
            </select>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" aria-hidden>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </span>
          </div>
          <button
            type="button"
            className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium px-6 py-3 rounded-lg transition-colors shadow-sm"
          >
            Search
          </button>
        </div>
      </div>
    </div>
  );
};

export default SearchBar;
