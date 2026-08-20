import React, { useState } from 'react';

interface StarRatingProps {
  rating?: number;
  maxStars?: number;
  interactive?: boolean;
  onChange?: (rating: number) => void;
  className?: string;
}

export function StarRating({
  rating = 0,
  maxStars = 5,
  interactive = false,
  onChange,
  className = '',
}: StarRatingProps) {
  const [hoverRating, setHoverRating] = useState(0);

  const activeRating = interactive && hoverRating > 0 ? hoverRating : rating;

  return (
    <div className={`flex gap-1.5 ${className}`}>
      {Array.from({ length: maxStars }).map((_, index) => {
        const starValue = index + 1;
        const isFilled = starValue <= activeRating;

        return (
          <button
            key={index}
            type="button"
            disabled={!interactive}
            onClick={() => interactive && onChange?.(starValue)}
            onMouseEnter={() => interactive && setHoverRating(starValue)}
            onMouseLeave={() => interactive && setHoverRating(0)}
            className={`p-1 -m-1 transition-transform duration-150 ${
              interactive ? 'cursor-pointer hover:scale-110 active:scale-90' : 'cursor-default'
            }`}
          >
            <svg
              className={`w-7 h-7 transition-colors duration-150 ${isFilled ? 'text-[var(--accent-ball-dark)] fill-current' : 'text-[var(--text-muted)] opacity-40 fill-current'}`}
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}
