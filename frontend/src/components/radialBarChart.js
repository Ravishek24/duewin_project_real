import React from 'react';

function RadialBarChart({ percentage, color = '#f59e0b', textColor = '#ffffff', backgroundColor = '#e5e7eb' }) {
  return (
    <div className="relative flex items-center justify-center w-64 h-64">
      <svg viewBox="0 0 1100 1100" className="w-full h-full">
        {/* Background circle */}
        <path
          d="M 550 550 m 0, -500 a 500, 500 0 1, 1 0, 1000 a 500, 500 0 1, 1 0, -1000"
          className="van-circle__layer"
          style={{ fill: 'none', strokeWidth: '100px', stroke: backgroundColor }}
        ></path>
        {/* Foreground (progress) circle */}
        <path
          d="M 550 550 m 0, -500 a 500, 500 0 1, 1 0, 1000 a 500, 500 0 1, 1 0, -1000"
          className="van-circle__hover"
          style={{
            strokeWidth: '101px',
            strokeLinecap: 'butt',
            stroke: color, // Custom color for the progress circle
            strokeDasharray: `${(percentage / 100) * 3140}px, 3140px`,
          }}
        ></path>
      </svg>
      {/* Percentage text */}
      <div className="absolute text-3xl font-bold" style={{ color: textColor }}>{percentage}%</div> {/* White text */}
    </div>
  );
}

export default RadialBarChart;
