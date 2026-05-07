import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

const Card: React.FC<CardProps> = ({ children, className = '' }) => {
  return (
    <div className={`relative p-[1px] bg-gradient-to-r from-primary/50 to-tertiary/50 rounded-[24px] shadow-glow ${className}`}>
      <div className="bg-neutral/90 backdrop-blur-md rounded-[23px] p-xl h-full w-full border-[0.8px] border-white/5">
        {children}
      </div>
    </div>
  );
};

export default Card;
