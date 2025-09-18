import React, { memo, useCallback } from 'react';
import { Upload, FileText } from 'lucide-react';

const DropZone = memo(({ 
    onDrop, 
    onFileSelect, 
    accept = ".csv,.xlsx", 
    title = "Glissez-déposez votre fichier ici",
    subtitle = "ou cliquez pour sélectionner un fichier",
    description = "Formats acceptés: CSV, XLSX",
    inputId,
    icon: Icon = Upload,
    borderColor = "border-gray-300 hover:border-blue-500"
}) => {
    const handleDragOver = useCallback((e) => {
        e.preventDefault();
    }, []);

    const handleClick = useCallback(() => {
        document.getElementById(inputId).click();
    }, [inputId]);

    const handleFileChange = useCallback((e) => {
        const file = e.target.files[0];
        if (file && onFileSelect) {
            onFileSelect(file);
        }
    }, [onFileSelect]);

    return (
        <>
            <div
                className={`border-2 border-dashed ${borderColor} rounded-xl p-10 text-center transition-colors duration-200 cursor-pointer bg-gray-50`}
                onDragOver={handleDragOver}
                onDrop={onDrop}
                onClick={handleClick}
            >
                <Icon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <p className="text-xl font-medium text-gray-900 mb-2">
                    {title}
                </p>
                <p className="text-sm text-gray-500 mb-4">
                    {subtitle}
                </p>
                <p className="text-xs text-gray-400">
                    {description}
                </p>
            </div>

            <input
                id={inputId}
                type="file"
                accept={accept}
                onChange={handleFileChange}
                className="hidden"
            />
        </>
    );
});

DropZone.displayName = 'DropZone';

export default DropZone;