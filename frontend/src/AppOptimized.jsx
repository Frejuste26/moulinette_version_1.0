import React, { useCallback, useMemo, lazy, Suspense } from 'react';
import { CheckCircle, Download } from 'lucide-react';
import Header from './components/Header';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingSpinner from './components/LoadingSpinner';
import DropZone from './components/DropZone';
import FileDisplay from './components/FileDisplay';
import StatsCard from './components/StatsCard';
import { useToast } from './components/Toast';
import { useAppState } from './hooks/useAppState';
import { useFileHandler } from './hooks/useFileHandler';

// Lazy loading des composants lourds
const SessionManager = lazy(() => import('./components/SessionManager'));
const ProgressIndicator = lazy(() => import('./components/ProgressIndicator'));

const SageInventoryApp = () => {
    const { showSuccess, showError, showInfo, ToastContainer } = useToast();
    const {
        originalFile,
        completedFile,
        uploadStatus,
        processStatus,
        uploadResult,
        processResult,
        error,
        currentStep,
        progressDetails,
        isProcessing,
        hasError,
        canProceedToStep2,
        canDownloadFinal,
        setOriginalFile,
        setCompletedFile,
        setError,
        resetAll,
        setUploadProgress,
        setProcessProgress
    } = useAppState();

    const { createDragHandlers, validateFile, createMockFile } = useFileHandler();

    // URL de base de l'API - memoized
    const API_BASE_URL = useMemo(() => 'http://localhost:5000/api', []);

    // Étapes du processus - memoized
    const processSteps = useMemo(() => [
        {
            title: "Import du fichier Sage X3",
            description: "Validation et traitement du fichier d'inventaire initial"
        },
        {
            title: "Génération du template",
            description: "Création du fichier Excel pour la saisie des quantités réelles"
        },
        {
            title: "Saisie des quantités",
            description: "Complétion du template avec les quantités réellement comptées"
        },
        {
            title: "Calcul des écarts",
            description: "Analyse des différences et répartition selon la stratégie FIFO"
        },
        {
            title: "Génération du fichier final",
            description: "Création du fichier CSV corrigé pour réimport dans Sage X3"
        }
    ], []);

    // Handlers pour le drag & drop - memoized
    const originalDropHandlers = useMemo(() => 
        createDragHandlers((file) => {
            const validation = validateFile(file, ['.csv', '.xlsx']);
            if (validation.isValid) {
                setOriginalFile(file);
                setError('');
            } else {
                showError(validation.error);
            }
        }), [createDragHandlers, validateFile, setOriginalFile, setError, showError]
    );

    const completedDropHandlers = useMemo(() => 
        createDragHandlers((file) => {
            const validation = validateFile(file, ['.xlsx', '.xls']);
            if (validation.isValid) {
                setCompletedFile(file);
                setError('');
            } else {
                showError(validation.error);
            }
        }), [createDragHandlers, validateFile, setCompletedFile, setError, showError]
    );

    // Traitement du fichier original - optimized
    const handleUploadFile = useCallback(async () => {
        if (!originalFile) {
            const errorMsg = 'Veuillez sélectionner un fichier CSV Sage X3';
            setError(errorMsg);
            showError(errorMsg);
            return;
        }

        const formData = new FormData();
        formData.append('file', originalFile);

        setUploadProgress('uploading', null, 0, 'Validation du format et traitement des données...');
        setError('');

        try {
            const response = await fetch(`${API_BASE_URL}/upload`, {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (response.ok) {
                setUploadProgress('success', data, 1, 'Template prêt à être téléchargé');
                showSuccess('Fichier traité avec succès !');
            } else {
                throw new Error(data.error || 'Erreur lors du traitement du fichier');
            }
        } catch (err) {
            setUploadProgress('error', null, 0, '');
            setError(err.message);
            showError(err.message);
        }
    }, [originalFile, API_BASE_URL, setUploadProgress, setError, showSuccess, showError]);

    // Génération du template Excel - optimized
    const handleDownloadTemplate = useCallback(async () => {
        if (!uploadResult?.session_id) {
            const errorMsg = 'Aucune session active pour générer le template';
            setError(errorMsg);
            showError(errorMsg);
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/download/template/${uploadResult.session_id}`);
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;

                const contentDisposition = response.headers.get('Content-Disposition');
                let filename = `inventaire_template_${uploadResult.session_id}.xlsx`;

                if (contentDisposition) {
                    const filenameMatch = contentDisposition.match(/filename\*=(?:utf-8'')?([^;]+)|filename="([^"]+)"|filename=([^;]+)/i);
                    if (filenameMatch) {
                        if (filenameMatch[1]) {
                            try {
                                filename = decodeURIComponent(filenameMatch[1]);
                            } catch (e) {
                                filename = filenameMatch[1];
                            }
                        } else if (filenameMatch[2]) {
                            filename = filenameMatch[2];
                        } else if (filenameMatch[3]) {
                            filename = filenameMatch[3].trim();
                        }
                    }
                }
                
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                showSuccess('Template téléchargé avec succès !');
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Erreur lors du téléchargement du template');
            }
        } catch (err) {
            setError(err.message);
            showError(err.message);
        }
    }, [uploadResult, API_BASE_URL, setError, showSuccess, showError]);

    // Traitement du fichier complété - optimized
    const handleProcessCompleted = useCallback(async () => {
        if (!completedFile) {
            const errorMsg = 'Veuillez sélectionner le fichier Excel complété';
            setError(errorMsg);
            showError(errorMsg);
            return;
        }
        if (!uploadResult?.session_id) {
            const errorMsg = 'Veuillez d\'abord importer et traiter le fichier original.';
            setError(errorMsg);
            showError(errorMsg);
            return;
        }

        const formData = new FormData();
        formData.append('file', completedFile);
        formData.append('session_id', uploadResult.session_id);

        setProcessProgress('processing', null, 3, 'Calcul des écarts et répartition FIFO en cours...');
        setError('');

        try {
            const response = await fetch(`${API_BASE_URL}/process`, {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (response.ok) {
                setProcessProgress('success', data, 4, 'Fichier final généré et prêt au téléchargement');
                showSuccess('Traitement terminé avec succès !');
            } else {
                throw new Error(data.error || 'Erreur lors du calcul des écarts');
            }
        } catch (err) {
            setProcessProgress('error', null, 3, '');
            setError(err.message);
            showError(err.message);
        }
    }, [completedFile, uploadResult, API_BASE_URL, setProcessProgress, setError, showSuccess, showError]);

    // Téléchargement du fichier final - optimized
    const handleDownloadFinalFile = useCallback(async () => {
        if (!uploadResult?.session_id) {
            const errorMsg = 'Aucun ID de session disponible pour télécharger le fichier final.';
            setError(errorMsg);
            showError(errorMsg);
            return;
        }
        if (!processResult?.final_url) {
            const errorMsg = 'Le fichier final n\'a pas été généré ou son URL est manquante.';
            setError(errorMsg);
            showError(errorMsg);
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/download/final/${uploadResult.session_id}`);
            
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                
                const contentDisposition = response.headers.get('Content-Disposition');
                let filename = `inventaire_corrige_${uploadResult.session_id}.csv`;
                
                if (contentDisposition) {
                    const filenameMatch = contentDisposition.match(/(?:filename\*=(?:UTF-8'')?([^;]+))|(?:filename="([^"]+)")|filename=([^;]+)/i);
                    if (filenameMatch) {
                        if (filenameMatch[1]) {
                            try {
                                filename = decodeURIComponent(filenameMatch[1]);
                            } catch (e) {
                                filename = filenameMatch[1];
                            }
                        } else if (filenameMatch[2]) {
                            filename = filenameMatch[2];
                        } else if (filenameMatch[3]) {
                            filename = filenameMatch[3].trim();
                        }
                    }
                }
                
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                setError('');
                showSuccess('Fichier final téléchargé avec succès !');
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Erreur lors du téléchargement du fichier final.');
            }
        } catch (err) {
            setError(err.message);
            showError(err.message);
        }
    }, [uploadResult, processResult, API_BASE_URL, setError, showSuccess, showError]);

    // Gestion de la sélection de session - optimized
    const handleSessionSelect = useCallback((session) => {
        try {
            resetAll();
            
            const mockOriginalFile = createMockFile(session.original_filename || 'Fichier original', 0);
            
            if (session.status === 'template_generated' || session.status === 'completed') {
                setOriginalFile(mockOriginalFile);
                setUploadProgress('success', {
                    session_id: session.id,
                    stats: {
                        nb_articles: session.stats?.nb_articles || 0,
                        total_quantity: session.stats?.total_quantity || 0,
                        nb_lots: session.stats?.nb_lots || 0
                    }
                }, session.status === 'completed' ? 4 : 1, 
                session.status === 'completed' ? 'Session terminée - Fichier final disponible' : 'Template disponible pour téléchargement');
                
                if (session.status === 'completed') {
                    setProcessProgress('success', {
                        final_url: `/api/download/final/${session.id}`,
                        stats: {
                            total_discrepancy: session.stats?.total_discrepancy || 0,
                            adjusted_items: session.stats?.adjusted_items_count || 0,
                            strategy_used: session.stats?.strategy_used || 'FIFO'
                        }
                    });
                    showSuccess(`Session ${session.id} reprise - Traitement terminé`);
                } else {
                    showSuccess(`Session ${session.id} reprise - Template disponible`);
                }
            } else {
                showInfo(`Session ${session.id} sélectionnée (statut: ${session.status})`);
            }
        } catch (error) {
            showError(`Erreur lors de la reprise de la session: ${error.message}`);
        }
    }, [resetAll, createMockFile, setOriginalFile, setUploadProgress, setProcessProgress, showSuccess, showError, showInfo]);

    // Réinitialisation optimisée
    const handleReset = useCallback(() => {
        resetAll();
        showInfo('Session réinitialisée');
    }, [resetAll, showInfo]);

    return (
        <ErrorBoundary>
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 font-sans text-gray-800">
                <ToastContainer />
                
                <Header />

                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {/* Message d'erreur */}
                    {error && (
                        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-6 animate-fade-in" role="alert">
                            <strong className="font-bold">Erreur : </strong>
                            <span className="block sm:inline">{error}</span>
                            <button 
                                onClick={() => setError('')}
                                className="absolute top-0 bottom-0 right-0 px-4 py-3"
                            >
                                <svg className="fill-current h-6 w-6 text-red-500 cursor-pointer" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                                    <title>Close</title>
                                    <path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/>
                                </svg>
                            </button>
                        </div>
                    )}

                    {/* Indicateur de progression avec lazy loading */}
                    {(uploadStatus !== 'idle' || processStatus !== 'idle') && (
                        <Suspense fallback={<LoadingSpinner message="Chargement de l'indicateur de progression..." />}>
                            <ProgressIndicator
                                steps={processSteps}
                                currentStep={currentStep}
                                status={hasError ? 'error' : isProcessing ? 'processing' : 'idle'}
                                error={error}
                                details={progressDetails}
                            />
                        </Suspense>
                    )}

                    {/* Étape 1: Import fichier original */}
                    <div className={`bg-white rounded-xl shadow-lg p-6 mb-8 border border-gray-200 transition-all duration-300 ${uploadStatus === 'success' ? 'opacity-75' : ''}`}>
                        <h2 className="text-xl font-semibold text-gray-900 mb-5 flex items-center">
                            <span className="h-6 w-6 mr-3 text-blue-600">📤</span>
                            1. Importation du fichier Sage X3
                        </h2>

                        {uploadStatus === 'idle' && (
                            <div className="space-y-5 animate-fade-in">
                                <DropZone
                                    {...originalDropHandlers}
                                    onFileSelect={setOriginalFile}
                                    inputId="original-file-input"
                                    title="Glissez-déposez votre fichier Sage X3 ici"
                                    description="Formats acceptés: CSV, XLSX (format Sage X3 avec en-têtes E/L)"
                                />

                                <FileDisplay
                                    file={originalFile}
                                    onCancel={() => setOriginalFile(null)}
                                    onAction={handleUploadFile}
                                    actionLabel="Traiter le fichier"
                                    bgColor="blue"
                                />
                            </div>
                        )}

                        {uploadStatus === 'uploading' && (
                            <div className="text-center py-12">
                                <LoadingSpinner message="Traitement du fichier en cours..." />
                            </div>
                        )}

                        {uploadStatus === 'success' && uploadResult && (
                            <div className="space-y-6 animate-fade-in">
                                <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                                    <div className="flex items-center mb-4">
                                        <CheckCircle className="h-6 w-6 text-green-600 mr-3" />
                                        <h3 className="font-semibold text-green-900 text-lg">Fichier traité avec succès !</h3>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                                        <StatsCard 
                                            title="Articles traités" 
                                            value={uploadResult.stats.nb_articles} 
                                        />
                                        <StatsCard 
                                            title="Quantité totale" 
                                            value={uploadResult.stats.total_quantity} 
                                        />
                                        <StatsCard 
                                            title="Lots traités" 
                                            value={uploadResult.stats.nb_lots} 
                                        />
                                    </div>

                                    <button
                                        onClick={handleDownloadTemplate}
                                        className="w-full bg-green-600 text-white py-3 px-4 rounded-xl hover:bg-green-700 transition-colors duration-200 font-semibold flex items-center justify-center shadow-md"
                                    >
                                        <Download className="h-5 w-5 mr-2" />
                                        Télécharger le template
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Étape 2: Réimport fichier complété */}
                    <div className={`bg-white rounded-xl shadow-lg p-6 mb-8 border border-gray-200 transition-all duration-300 ${!canProceedToStep2 ? 'opacity-50 pointer-events-none' : ''}`}>
                        <h2 className="text-xl font-semibold text-gray-900 mb-5 flex items-center">
                            <span className="h-6 w-6 mr-3 text-purple-600">📥</span>
                            2. Réimportation du fichier complété
                        </h2>

                        {processStatus !== 'success' && (
                            <div className="space-y-5 animate-fade-in">
                                <DropZone
                                    {...completedDropHandlers}
                                    onFileSelect={setCompletedFile}
                                    inputId="completed-file-input"
                                    title="Glissez-déposez le fichier Excel complété"
                                    description="Format accepté: XLSX (template complété)"
                                    accept=".xlsx,.xls"
                                    borderColor="border-gray-300 hover:border-purple-500"
                                />

                                <FileDisplay
                                    file={completedFile}
                                    onCancel={() => setCompletedFile(null)}
                                    onAction={handleProcessCompleted}
                                    actionLabel="Calculer les écarts"
                                    actionColor="purple"
                                    bgColor="purple"
                                />
                            </div>
                        )}

                        {processStatus === 'processing' && (
                            <div className="text-center py-12">
                                <LoadingSpinner message="Calcul des écarts et génération du fichier final..." />
                            </div>
                        )}

                        {processStatus === 'success' && processResult && (
                            <div className="space-y-6 animate-fade-in">
                                <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                                    <div className="flex items-center mb-4">
                                        <CheckCircle className="h-6 w-6 text-green-600 mr-3" />
                                        <h3 className="font-semibold text-green-900 text-lg">Traitement terminé avec succès !</h3>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                                        <StatsCard 
                                            title="Écart total" 
                                            value={processResult.stats.total_discrepancy} 
                                        />
                                        <StatsCard 
                                            title="Articles ajustés" 
                                            value={processResult.stats.adjusted_items} 
                                        />
                                        <StatsCard 
                                            title="Stratégie" 
                                            value={processResult.stats.strategy_used} 
                                        />
                                    </div>

                                    <button
                                        onClick={handleDownloadFinalFile}
                                        className="w-full bg-green-600 text-white py-3 px-4 rounded-xl hover:bg-green-700 transition-colors duration-200 font-semibold flex items-center justify-center shadow-md"
                                    >
                                        <Download className="h-5 w-5 mr-2" />
                                        Télécharger le fichier final
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Bouton de réinitialisation */}
                    {(uploadStatus !== 'idle' || processStatus !== 'idle') && (
                        <div className="text-center mb-8">
                            <button
                                onClick={handleReset}
                                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200 font-medium"
                            >
                                Nouvelle session
                            </button>
                        </div>
                    )}

                    {/* Gestionnaire de sessions avec lazy loading */}
                    <Suspense fallback={<LoadingSpinner message="Chargement du gestionnaire de sessions..." />}>
                        <SessionManager onSessionSelect={handleSessionSelect} />
                    </Suspense>
                </div>
            </div>
        </ErrorBoundary>
    );
};

export default SageInventoryApp;