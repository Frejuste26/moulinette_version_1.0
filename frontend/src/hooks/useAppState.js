import { useState, useCallback, useMemo } from 'react';

export const useAppState = () => {
    // États pour la gestion des fichiers
    const [originalFile, setOriginalFile] = useState(null);
    const [completedFile, setCompletedFile] = useState(null);

    // États pour le statut des opérations
    const [uploadStatus, setUploadStatus] = useState('idle');
    const [processStatus, setProcessStatus] = useState('idle');

    // Résultats des opérations
    const [uploadResult, setUploadResult] = useState(null);
    const [processResult, setProcessResult] = useState(null);

    // Gestion des erreurs
    const [error, setError] = useState('');
    
    // Étapes du processus
    const [currentStep, setCurrentStep] = useState(0);
    const [progressDetails, setProgressDetails] = useState('');

    // Actions optimisées avec useCallback
    const resetAll = useCallback(() => {
        setOriginalFile(null);
        setCompletedFile(null);
        setUploadStatus('idle');
        setProcessStatus('idle');
        setUploadResult(null);
        setProcessResult(null);
        setError('');
        setCurrentStep(0);
        setProgressDetails('');
    }, []);

    const setUploadProgress = useCallback((status, result = null, step = 0, details = '') => {
        setUploadStatus(status);
        setUploadResult(result);
        setCurrentStep(step);
        setProgressDetails(details);
    }, []);

    const setProcessProgress = useCallback((status, result = null, step = 0, details = '') => {
        setProcessStatus(status);
        setProcessResult(result);
        setCurrentStep(step);
        setProgressDetails(details);
    }, []);

    // État dérivé memoized
    const isProcessing = useMemo(() => 
        uploadStatus === 'uploading' || processStatus === 'processing', 
        [uploadStatus, processStatus]
    );

    const hasError = useMemo(() => 
        uploadStatus === 'error' || processStatus === 'error' || !!error, 
        [uploadStatus, processStatus, error]
    );

    const canProceedToStep2 = useMemo(() => 
        uploadStatus === 'success' && uploadResult?.session_id, 
        [uploadStatus, uploadResult]
    );

    const canDownloadFinal = useMemo(() => 
        processStatus === 'success' && processResult?.final_url, 
        [processStatus, processResult]
    );

    return {
        // États
        originalFile,
        completedFile,
        uploadStatus,
        processStatus,
        uploadResult,
        processResult,
        error,
        currentStep,
        progressDetails,
        
        // États dérivés
        isProcessing,
        hasError,
        canProceedToStep2,
        canDownloadFinal,
        
        // Setters
        setOriginalFile,
        setCompletedFile,
        setError,
        
        // Actions
        resetAll,
        setUploadProgress,
        setProcessProgress
    };
};