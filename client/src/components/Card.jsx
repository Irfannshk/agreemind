import React from 'react';

export default function Card({ children, title, className = '' }) {
  return (
    <div className={`bg-white border border-gray-200 rounded-xl shadow-sm p-5 ${className}`}>
      {title && <h3 className="text-lg font-semibold mb-3">{title}</h3>}
      {children}
    </div>
  );
}