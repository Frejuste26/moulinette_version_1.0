import React, { memo, useCallback } from 'react';
import { Download, Trash2 } from 'lucide-react';

const SessionItem = memo(({ 
    session, 
    onSessionSelect, 
    onDownload, 
    onDelete, 
    formatDate, 
    getStatusColor, 
    getStatusLabel 
}) => {
    const handleSessionSelect = useCallback(() => {
        onSessionSelect(session);
    }, [onSessionSelect, session]);

    const handleDownloadTemplate = useCallback(() => {
        onDownload(session.id, 'template');
    }, [onDownload, session.id]);

    const handleDownloadFinal = useCallback(() => {
        onDownload(session.id, 'final');
    }, [onDownload, session.id]);

    const handleDelete = useCallback(() => {
        onDelete(session.id);
    }, [onDelete, session.id]);

    return (
        <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                    <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                        {session.id}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(session.status)}`}>
                        {getStatusLabel(session.status)}
                    </span>
                </div>
                <div className="text-sm text-gray-500">
                    {formatDate(session.created_at || session.created)}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                    <p className="text-sm text-gray-600">Fichier original</p>
                    <p className="font-medium truncate" title={session.original_file}>
                        {session.original_filename || 'N/A'}
                    </p>
                </div>
                <div>
                    <p className="text-sm text-gray-600">Articles</p>
                    <p className="font-medium">{session.stats?.nb_articles || 0}</p>
                </div>
                <div>
                    <p className="text-sm text-gray-600">Quantité totale</p>
                    <p className="font-medium">{session.stats?.total_quantity || 0}</p>
                </div>
            </div>

            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    {/* Affichage conditionnel des boutons selon le statut */}
                    {session.status === 'template_generated' && (
                        <>
                            <button
                                onClick={handleDownloadTemplate}
                                className="flex items-center px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors duration-200 text-sm"
                            >
                                <Download className="h-4 w-4 mr-1" />
                                Template
                            </button>
                            <button
                                onClick={handleSessionSelect}
                                className="flex items-center px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors duration-200 text-sm font-medium"
                            >
                                Reprendre
                            </button>
                        </>
                    )}
                    {session.status === 'completed' && (
                        <>
                            <button
                                onClick={handleDownloadTemplate}
                                className="flex items-center px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors duration-200 text-sm"
                            >
                                <Download className="h-4 w-4 mr-1" />
                                Template
                            </button>
                            <button
                                onClick={handleDownloadFinal}
                                className="flex items-center px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors duration-200 text-sm"
                            >
                                <Download className="h-4 w-4 mr-1" />
                                Final
                            </button>
                            <button
                                onClick={handleSessionSelect}
                                className="flex items-center px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors duration-200 text-sm font-medium"
                            >
                                Reprendre
                            </button>
                        </>
                    )}
                    {!['template_generated', 'completed'].includes(session.status) && (
                        <button
                            onClick={handleSessionSelect}
                            className={`flex items-center px-3 py-2 rounded-lg transition-colors duration-200 text-sm ${
                                session.status === 'error' || session.status === 'processing' 
                                    ? 'bg-gray-100 text-gray-500 cursor-not-allowed' 
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                            disabled={session.status === 'error' || session.status === 'processing'}
                        >
                            {session.status === 'error' ? 'Erreur' : 
                             session.status === 'processing' ? 'En cours...' : 'Reprendre'}
                        </button>
                    )}
                </div>
                <button
                    onClick={handleDelete}
                    className="flex items-center px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors duration-200 text-sm"
                >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Supprimer
                </button>
            </div>
        </div>
    );
});

SessionItem.displayName = 'SessionItem';

export default SessionItem;