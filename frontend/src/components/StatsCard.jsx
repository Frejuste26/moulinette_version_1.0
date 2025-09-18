import React, { memo } from 'react';

const StatsCard = memo(({ title, value, className = "bg-white rounded-lg p-4 border border-green-200 shadow-sm" }) => {
    return (
        <div className={className}>
            <p className="text-sm text-green-700 font-medium">{title}</p>
            <p className="text-2xl font-bold text-green-900">{value}</p>
        </div>
    );
});

StatsCard.displayName = 'StatsCard';

export default StatsCard;