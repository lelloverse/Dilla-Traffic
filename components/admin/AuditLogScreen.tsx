import React, { useState, useEffect } from 'react';
import { FaShieldAlt, FaSearch, FaDownload } from 'react-icons/fa';
import { getAuditLogs } from '../../database';
import { AuditLog } from '../../types';

interface AuditLogScreenProps {
  onBack: () => void;
}

const AuditLogScreen: React.FC<AuditLogScreenProps> = ({ onBack }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState('All');
    const [logs, setLogs] = useState<AuditLog[]>([]);

    useEffect(() => {
        const fetchLogs = async () => {
            const data = await getAuditLogs();
            setLogs(data);
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

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto bg-white rounded-lg shadow-xl p-8 border border-gray-100">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <div>
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <FaShieldAlt size={32} color="#dc2626" />
                    Audit Logs
                </h1>
                <p className="text-gray-500">Track and monitor all system activities for compliance and security.</p>
            </div>
            <button
                onClick={onBack}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
            >
                Back to Dashboard
            </button>
        </div>

        {/* Filters */}
        <div className="bg-gray-50 p-4 rounded-lg mb-6 flex flex-col md:flex-row gap-4">
            <div className="flex-1">
                <label className="block text-sm font-medium mb-1 text-gray-700">Search Logs</label>
                <div className="relative">
                    <input 
                        type="text" 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search by user, action, or details..." 
                        className="w-full pl-10 pr-4 py-2 border rounded-lg bg-white"
                    />
                    <div className="text-gray-400 absolute left-3 top-2.5">
                        <FaSearch size={20} />
                    </div>
                </div>
            </div>
            <div className="w-full md:w-48">
                <label className="block text-sm font-medium mb-1 text-gray-700">Filter by Role</label>
                <select 
                    value={filterRole} 
                    onChange={(e) => setFilterRole(e.target.value)}
                    className="w-full p-2 border rounded-lg bg-white"
                >
                    <option value="All">All Roles</option>
                    <option value="Admin">Admin</option>
                    <option value="Clerk">Clerk</option>
                    <option value="Officer">Officer</option>
                </select>
            </div>
            <div className="w-full md:w-auto flex items-end">
                <button className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2">
                    <FaDownload size={16} />
                    Export Log
                </button>
            </div>
        </div>

        {/* Logs Table */}
        <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm text-left text-gray-500">
                <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                    <tr>
                        <th scope="col" className="px-6 py-3">Timestamp</th>
                        <th scope="col" className="px-6 py-3">User</th>
                        <th scope="col" className="px-6 py-3">Action</th>
                        <th scope="col" className="px-6 py-3">Details</th>
                        <th scope="col" className="px-6 py-3">IP Address</th>
                        <th scope="col" className="px-6 py-3">Status</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredLogs.length > 0 ? filteredLogs.map(log => (
                        <tr key={log.id} className="bg-white border-b hover:bg-gray-50 transition">
                            <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-gray-700 font-semibold">{formatTimestamp(log.timestamp)}</td>
                            <td className="px-6 py-4">
                                <div className="font-medium text-gray-900">{log.user}</div>
                                <div className="text-xs">{log.role}</div>
                            </td>
                            <td className="px-6 py-4 font-semibold text-gray-800">{log.action}</td>
                            <td className="px-6 py-4 max-w-xs truncate" title={log.details}>{log.details}</td>
                            <td className="px-6 py-4 font-mono text-xs">{log.ipAddress}</td>
                            <td className="px-6 py-4">
                                {log.status === 'success' ? (
                                    <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">Success</span>
                                ) : (
                                    <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded">Failure</span>
                                )}
                            </td>
                        </tr>
                    )) : (
                        <tr>
                            <td colSpan={6} className="px-6 py-8 text-center italic">No logs found matching your criteria.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};

export default AuditLogScreen;