import { useCallback } from 'react';

export const useFileHandler = () => {
    // Gestion du drag & drop optimisée
    const createDragHandlers = useCallback((onDrop) => {
        const onDragOver = (e) => e.preventDefault();
        
        const onDropHandler = (e) => {
            e.preventDefault();
            const file = Array.from(e.dataTransfer.files)[0];
            if (file && onDrop) {
                onDrop(file);
            }
        };

        return { onDragOver, onDrop: onDropHandler };
    }, []);

    // Validation de fichier optimisée
    const validateFile = useCallback((file, allowedTypes = ['.csv', '.xlsx']) => {
        if (!file) return { isValid: false, error: 'Aucun fichier sélectionné' };
        
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
        const isValidType = allowedTypes.includes(fileExtension);
        
        if (!isValidType) {
            return { 
                isValid: false, 
                error: `Type de fichier non supporté. Types acceptés: ${allowedTypes.join(', ')}` 
            };
        }

        const maxSize = 50 * 1024 * 1024; // 50MB
        if (file.size > maxSize) {
            return { 
                isValid: false, 
                error: 'Fichier trop volumineux (max 50MB)' 
            };
        }

        return { isValid: true, error: null };
    }, []);

    // Création de fichier mock optimisée
    const createMockFile = useCallback((filename, size = 0) => {
        return {
            name: filename,
            size: size,
            type: filename.endsWith('.xlsx') 
                ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
                : 'text/csv',
            lastModified: Date.now(),
            isMock: true
        };
    }, []);

    return {
        createDragHandlers,
        validateFile,
        createMockFile
    };
};