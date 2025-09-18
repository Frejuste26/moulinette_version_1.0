import React, { useState, useEffect, useCallback, memo } from 'react';
import { Clock, FileText, RefreshCw, AlertCircle, BarChart3 } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import SessionDashboard from './SessionDashboard';
import LoadingSpinner from './LoadingSpinner';
import SessionItem from './SessionItem';

const SessionManager = memo(({ onSessionSelect, onClose }) => {
    const [sessions, setSessions] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [showDashboard, setShowDashboard] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const { getSessions, downloadFile, deleteSession, loading } = useApi();

    const handleSessionSelect = useCallback((session) => {
        if (onSessionSelect) {
            onSessionSelect(session);
        }
        setIsOpen(false); // Fermer le modal après sélection
        setShowDashboard(false); // Fermer aussi le dashboard si ouvert
    }, [onSessionSelect]);

    const loadSessions = useCallback(async () => {
        try {
            const data = await getSessions();
            setSessions(data.sessions || []);
        } catch (error) {
            console.error('Erreur chargement sessions:', error);
        }
    }, [getSessions]);

    useEffect(() => {
        if (isOpen) {
            loadSessions();
        }
    }, [isOpen]);

    const handleDownload = useCallback(async (sessionId, type) => {
        try {
            await downloadFile(type, sessionId);
        } catch (error) {
            console.error('Erreur téléchargement:', error);
        }
    }, [downloadFile]);

    const handleDelete = useCallback(async (sessionId) => {
        try {
            await deleteSession(sessionId);
            setSessions(prevSessions => prevSessions.filter(s => s.id !== sessionId));
            setDeleteConfirm(null);
        } catch (error) {
            console.error('Erreur suppression:', error);
        }
    }, [deleteSession]);

    const formatDate = useCallback((dateString) => {
        return new Date(dateString).toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }, []);

    const getStatusColor = useCallback((status) => {
        const colors = {
            'template_generated': 'bg-blue-100 text-blue-800',
            'completed': 'bg-green-100 text-green-800',
            'error': 'bg-red-100 text-red-800',
            'processing': 'bg-yellow-100 text-yellow-800',
            'uploading': 'bg-gray-100 text-gray-800'
        };
        return colors[status] || 'bg-gray-100 text-gray-800';
    }, []);

    const getStatusLabel = useCallback((status) => {
        const labels = {
            'template_generated': 'Template généré',
            'completed': 'Terminé',
            'error': 'Erreur',
            'processing': 'En cours',
            'uploading': 'Upload en cours'
        };
        return labels[status] || status;
    }, []);

    if (!isOpen) {
        return (
            <div className="fixed bottom-6 right-6 z-40 flex flex-col space-y-3">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowDashboard(true);
                        setIsOpen(false); // S'assurer que SessionManager est fermé
                    }}
                    className="bg-purple-600 text-white p-4 rounded-full shadow-lg hover:bg-purple-700 transition-colors duration-200"
                    title="Tableau de bord des sessions"
                >
                    <BarChart3 className="h-6 w-6" />
                </button>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsOpen(true);
                        setShowDashboard(false); // S'assurer que Dashboard est fermé
                    }}
                    className="bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition-colors duration-200"
                    title="Sessions récentes"
                >
                    <Clock className="h-6 w-6" />
                </button>
                {/* Afficher le Dashboard même si SessionManager n'est pas ouvert */}
                {showDashboard && (
                    <SessionDashboard
                        onSessionSelect={(session) => {
                            onSessionSelect(session);
                            setShowDashboard(false);
                            setIsOpen(false);
                        }}
                        onClose={() => setShowDashboard(false)}
                    />
                )}
            </div>
        );
    }

    return (
        <>
            {/* SessionManager Modal */}
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
                 onClick={(e) => {
                     if (e.target === e.currentTarget) {
                         setIsOpen(false);
                     }
                 }}>
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
                <div className="bg-blue-600 text-white p-6 flex items-center justify-between">
                    <h2 className="text-xl font-semibold flex items-center">
                        <Clock className="h-6 w-6 mr-3" />
                        Gestionnaire de Sessions
                    </h2>
                    <div className="flex items-center space-x-3">
                        <button
                            onClick={loadSessions}
                            disabled={loading}
                            className="p-2 hover:bg-blue-700 rounded-lg transition-colors duration-200"
                        >
                            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-2 hover:bg-blue-700 rounded-lg transition-colors duration-200"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
                    {loading ? (
                        <LoadingSpinner message="Chargement des sessions..." />
                    ) : sessions.length === 0 ? (
                        <div className="text-center py-12">
                            <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-600">Aucune session trouvée</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {sessions.map((session) => (
                                <SessionItem
                                    key={session.id}
                                    session={session}
                                    onSessionSelect={handleSessionSelect}
                                    onDownload={handleDownload}
                                    onDelete={(sessionId) => setDeleteConfirm(sessionId)}
                                    formatDate={formatDate}
                                    getStatusColor={getStatusColor}
                                    getStatusLabel={getStatusLabel}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>

            {/* Modal de confirmation de suppression */}
            {deleteConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4"
                     onClick={(e) => {
                         if (e.target === e.currentTarget) {
                             setDeleteConfirm(null);
                         }
                     }}>
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
                        <div className="flex items-center mb-4">
                            <AlertCircle className="h-6 w-6 text-red-600 mr-3" />
                            <h3 className="text-lg font-semibold text-gray-900">Confirmer la suppression</h3>
                        </div>
                        <p className="text-gray-600 mb-6">
                            Êtes-vous sûr de vouloir supprimer la session <span className="font-mono bg-gray-100 px-1 rounded">{deleteConfirm}</span> ? 
                            Cette action est irréversible.
                        </p>
                        <div className="flex space-x-3">
                            <button
                                onClick={() => setDeleteConfirm(null)}
                                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={() => handleDelete(deleteConfirm)}
                                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200"
                            >
                                Supprimer
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Tableau de bord des sessions - seulement si SessionManager est ouvert */}
            {showDashboard && isOpen && (
                <SessionDashboard
                    onSessionSelect={(session) => {
                        onSessionSelect(session);
                        setShowDashboard(false);
                        setIsOpen(false);
                    }}
                    onClose={() => setShowDashboard(false)}
                />
            )}
        </>
    );
});

export default SessionManager;