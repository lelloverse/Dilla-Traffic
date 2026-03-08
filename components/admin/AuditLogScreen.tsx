import React, { useState, useEffect } from 'react';
import { FaShieldAlt, FaSearch, FaDownload } from 'react-icons/fa';
import { getAuditLogs } from '../../database';
import { AuditLog } from '../../types';
import { useTranslation } from 'react-i18next';

interface AuditLogScreenProps {
  onBack: () => void;
}

const AuditLogScreen: React.FC<AuditLogScreenProps> = ({ onBack }) => {
    const { t } = useTranslation();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState('All');
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchLogs = async () => {
            const data = await getAuditLogs();
            setLogs(data.reverse()); // Newest first
            setIsLoading(false);
        };
        fetchLogs();
    }, []);
    
    const formatTimestamp = (ts: string) => {
        try {
            const dateStr = ts.includes('T') ? ts : ts.replace(' ', 'T');
            const date = new Date(dateStr);
            return date.toLocaleString('en-US', {
                year: 'numeric',
                month: 'short',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            });
        } catch (e) {
            return ts;
        }
    };

    const filteredLogs = logs.filter(log => {
        const matchesSearch = log.user.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              log.details.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRole = filterRole === 'All' || log.role === filterRole;
        return matchesSearch && matchesRole;
    });

    const handleExport = () => {
        const csvContent = "data:text/csv;charset=utf-8," 
          + ["Timestamp,User,Role,Action,Details,IP,Status"].join(",") + "\n"
          + filteredLogs.map(log => [
              log.timestamp,
              log.user,
              log.role,
              log.action,
              `"${log.details}"`,
              log.ipAddress,
              log.status
            ].join(",")).join("\n");
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `audit_log_${new Date().toISOString()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

  return (
    <div className="p-4 md:p-8 animate-fade-in">
      <div className="max-w-7xl mx-auto bg-white rounded-lg shadow-xl p-8 border border-gray-100">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 border-b pb-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                    <FaShieldAlt size={32} color="#dc2626" />
                    {t('auditLogsTitle')}
                </h1>
                <p className="text-gray-500 mt-1">{t('auditLogsSubtitle')}</p>
            </div>
            <div className="flex gap-3">
                <button 
                    onClick={handleExport}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
                >
                    <FaDownload size={14} /> {t('exportLog')}
                </button>
                <button
                    onClick={onBack}
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition font-medium"
                >
                    {t('backToDashboard')}
                </button>
            </div>
        </div>

        {/* Filters */}
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-6 flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <FaSearch size={14} />
                </span>
                <input 
                    type="text" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={t('searchLogsPlaceholder')} 
                    className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
                />
            </div>
            <div className="flex gap-2 w-full md:w-auto">
                <select 
                    value={filterRole} 
                    onChange={(e) => setFilterRole(e.target.value)}
                    className="flex-1 md:w-48 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                    <option value="All">{t('allRoles')}</option>
                    <option value="Admin">{t('admin')}</option>
                    <option value="Clerk">{t('clerk')}</option>
                    <option value="Officer">{t('officer')}</option>
                </select>
            </div>
        </div>

        {/* Logs Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">{t('timestamp')}</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">{t('user')}</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">{t('action')}</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">{t('ipAddress')}</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">{t('status')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {isLoading ? (
                          <tr>
                            <td colSpan={5} className="px-6 py-12 text-center">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
                            </td>
                          </tr>
                        ) : filteredLogs.length > 0 ? filteredLogs.map((log, idx) => (
                            <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">{formatTimestamp(log.timestamp)}</td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-gray-900">{log.user}</span>
                                        <span className="text-xs text-gray-500 uppercase">{t(log.role.toLowerCase())}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium text-gray-800">{log.action}</span>
                                        <span className="text-xs text-gray-500 italic">{log.details}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-xs font-mono text-gray-500">{log.ipAddress}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold border uppercase ${
                                      log.status === 'success' 
                                        ? 'bg-green-50 text-green-700 border-green-100' 
                                        : 'bg-red-50 text-red-700 border-red-100'
                                    }`}>
                                      {t(log.status)}
                                    </span>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-gray-500 italic">{t('noLogsFound')}</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
      </div>
    </div>
  );
};

export default AuditLogScreen;