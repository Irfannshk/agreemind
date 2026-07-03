import React from 'react';

export default function Button({ children, onClick, variant = 'primary', className = '' }) {
  const baseStyle = "px-4 py-2 rounded-md font-medium transition-colors duration-200";
  
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700",
    outline: "border border-gray-300 text-gray-700 hover:bg-gray-50",
    danger: "bg-red-600 text-white hover:bg-red-700"
  };

  return (
    <button 
      onClick={onClick} 
      className={`${baseStyle} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}