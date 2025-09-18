import React, { memo, useCallback } from 'react';
import { FileText } from 'lucide-react';

const FileDisplay = memo(({ 
    file, 
    onCancel, 
    onAction, 
    actionLabel = "Traiter le fichier",
    actionColor = "blue",
    showAction = true,
    bgColor = "blue"
}) => {
    const handleCancel = useCallback(() => {
        if (onCancel) onCancel();
    }, [onCancel]);

    const handleAction = useCallback(() => {
        if (onAction) onAction();
    }, [onAction]);

    const getBgColorClass = (color) => {
        const colors = {
            blue: 'bg-blue-50 border-blue-200',
            purple: 'bg-purple-50 border-purple-200',
            green: 'bg-green-50 border-green-200'
        };
        return colors[color] || colors.blue;
    };

    const getTextColorClass = (color) => {
        const colors = {
            blue: 'text-blue-900',
            purple: 'text-purple-900',
            green: 'text-green-900'
        };
        return colors[color] || colors.blue;
    };

    const getIconColorClass = (color) => {
        const colors = {
            blue: 'text-blue-600',
            purple: 'text-purple-600',
            green: 'text-green-600'
        };
        return colors[color] || colors.blue;
    };

    const getButtonColorClass = (color) => {
        const colors = {
            blue: 'bg-blue-600 hover:bg-blue-700',
            purple: 'bg-purple-600 hover:bg-purple-700',
            green: 'bg-green-600 hover:bg-green-700'
        };
        return colors[color] || colors.blue;
    };

    const getBorderColorClass = (color) => {
        const colors = {
            blue: 'border-blue-300 hover:bg-blue-100 text-blue-700 hover:text-blue-900',
            purple: 'border-purple-300 hover:bg-purple-100 text-purple-700 hover:text-purple-900',
            green: 'border-green-300 hover:bg-green-100 text-green-700 hover:text-green-900'
        };
        return colors[color] || colors.blue;
    };

    if (!file) return null;

    return (
        <div className={`${getBgColorClass(bgColor)} border rounded-lg p-4 flex items-center justify-between animate-fade-in`}>
            <div className="flex items-center space-x-3">
                <FileText className={`h-8 w-8 ${getIconColorClass(bgColor)}`} />
                <div>
                    <p className={`font-medium ${getTextColorClass(bgColor)}`}>{file.name}</p>
                    <p className={`text-sm ${getTextColorClass(bgColor).replace('900', '700')}`}>
                        {file.isMock ? 'Session reprise' : `${(file.size / 1024 / 1024).toFixed(2)} MB`}
                    </p>
                </div>
            </div>
            <div className="flex space-x-3">
                {!file.isMock && showAction && (
                    <>
                        <button
                            onClick={handleCancel}
                            className={`px-4 py-2 text-sm border rounded-lg transition-colors duration-200 ${getBorderColorClass(bgColor)}`}
                        >
                            Annuler
                        </button>
                        <button
                            onClick={handleAction}
                            className={`px-5 py-2 text-white rounded-lg transition-colors duration-200 font-medium shadow-md ${getButtonColorClass(actionColor)}`}
                        >
                            {actionLabel}
                        </button>
                    </>
                )}
                {file.isMock && (
                    <div className="px-4 py-2 text-sm text-green-700 bg-green-100 rounded-lg">
                        Session active
                    </div>
                )}
            </div>
        </div>
    );
});

FileDisplay.displayName = 'FileDisplay';

export default FileDisplay;