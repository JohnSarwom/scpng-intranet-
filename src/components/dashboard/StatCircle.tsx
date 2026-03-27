
import React from 'react';

interface StatCircleProps {
  percentage: number;
  label: string;
  size?: number;
  thickness?: number;
  textSize?: string;
  labelSize?: string;
  gradientColors?: string[];
}

const StatCircle: React.FC<StatCircleProps> = ({
  percentage,
  label,
  size = 140,
  thickness = 10,
  textSize = 'text-3xl',
  labelSize = 'text-xs',
  gradientColors = ['#FF6B6B', '#4169E1', '#6A5ACD']
}) => {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  const gradientId = `circleGradient-${label.replace(/\s+/g, '')}`;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            {gradientColors.map((color, index) => (
              <stop 
                key={index}
                offset={`${(index / (gradientColors.length - 1)) * 100}%`} 
                stopColor={color} 
              />
            ))}
          </linearGradient>
        </defs>
        
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="currentColor"
          className="text-slate-100 dark:text-gray-700"
          strokeWidth={thickness}
        />
        
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke={`url(#${gradientId})`}
          strokeWidth={thickness}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      
      <div className="absolute flex flex-col items-center">
        <span className={`font-bold ${textSize} dark:text-gray-100`}>{percentage}%</span>
        <span className={`uppercase text-gray-500 dark:text-gray-400 ${labelSize}`}>{label}</span>
      </div>
    </div>
  );
};

export default StatCircle;
