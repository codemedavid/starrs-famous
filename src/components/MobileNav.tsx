import React from 'react';
import { useCategories } from '../hooks/useCategories';

interface MobileNavProps {
  activeCategory: string;
  onCategoryClick: (categoryId: string) => void;
}

const MobileNav: React.FC<MobileNavProps> = ({ activeCategory, onCategoryClick }) => {
  const { categories } = useCategories();

  return (
    <div className="sticky top-16 z-40 bg-starrs-mint/95 backdrop-blur-sm border-b border-starrs-teal/30 md:hidden shadow-sm">
      <div className="flex overflow-x-auto scrollbar-hide px-4 py-3">
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => onCategoryClick(category.id)}
            className={`flex-shrink-0 flex items-center space-x-2 px-4 py-2 rounded-full mr-3 transition-all duration-200 ${
              activeCategory === category.id
                ? 'bg-starrs-teal text-white shadow-md'
                : 'bg-white/80 text-starrs-teal-dark border border-starrs-teal/30 hover:bg-starrs-teal-light'
            }`}
          >
            <span className="text-lg">{category.icon}</span>
            <span className="text-sm font-semibold whitespace-nowrap">{category.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default MobileNav;