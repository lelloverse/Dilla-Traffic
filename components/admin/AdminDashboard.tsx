import React, { useState, useEffect } from 'react';
import type { AdminView } from '../../App';
import { FaUsers, FaFileAlt, FaCog, FaShieldAlt } from 'react-icons/fa';
import { getPayments, getAuditLogs } from '../../database';
import { Payment, AuditLog } from '../../types';

interface AdminDashboardProps {
  onNavigate: (view: AdminView) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
  const [weeklyData, setWeeklyData] = useState<{ day: string; amount: number; height: string }[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [activities, setActivities] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
        try {
            // Activities
            const logs = await getAuditLogs();
            setActivities(logs.slice(0, 5));

            // Payments
            const payments = await getPayments();
            const today = new Date();
            const last7Days = Array.from({ length: 7 }, (_, i) => {
                const d = new Date();
                d.setDate(today.getDate() - (6 - i));
                return d;
            });

            const dailyRevenue = last7Days.map(date => {
                const dateString = date.toISOString().split('T')[0];
                const dayAmount = payments
                    .filter(p => {
                        if (!p.date) return false;
                        // Extract YYYY-MM-DD from the payment date string
                        const pDate = p.date.includes('T') ? p.date.split('T')[0] : p.date.split(' ')[0];
                        return pDate === dateString;
                    })
                    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
                
                return {
                    day: date.toLocaleDateString('en-US', { weekday: 'short' }),
                    amount: dayAmount,
                    dateString
                };
            });

            const maxAmount = Math.max(...dailyRevenue.map(d => Number(d.amount || 0)), 1000); // Avoid division by zero
            const formattedData = dailyRevenue.map(d => ({
                day: d.day,
                amount: d.amount,
                height: `${Math.max((Number(d.amount || 0) / maxAmount) * 100, 5)}%` // Min 5% height for visibility
            }));

            setWeeklyData(formattedData);
            setTotalRevenue(dailyRevenue.reduce((sum, d) => sum + Number(d.amount || 0), 0));
        } catch (error) {
            console.error('Error fetching admin dashboard data:', error);
        } finally {
            setIsLoading(false);
        }
    };
    fetchData();
  }, []);

  if (isLoading) {
    return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
    );
  }

  const formatTimeAgo = (timestamp: string) => {
    // Handle both old "YYYY-MM-DD HH:mm:ss" and new ISO string formats
    const dateStr = timestamp.includes('T') ? timestamp : timestamp.replace(' ', 'T');
    const logDate = new Date(dateStr);
    const now = new Date();
    const diffInMs = now.getTime() - logDate.getTime();
    const diffInMins = Math.floor(diffInMs / 60000);
    
    if (diffInMins < 1) return 'Just now';
    if (diffInMins < 60) return `${diffInMins}m ago`;
    const diffInHours = Math.floor(diffInMins / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    return logDate.toLocaleString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
    });
  };

  return (
    <div className="text-gray-900">
      <main className="p-4 md:p-8 space-y-8">
        
        <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Administrator Portal</h1>
            <p className="text-gray-500 mt-2">Oversee system security, user access, and operational compliance.</p>
        </div>

        {/* Quick Links */}
        <section>
            <h2 className="text-xl font-semibold mb-4">Management Modules</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <button onClick={() => onNavigate('user-management')} className="flex flex-col items-center justify-center p-6 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg transition transform hover:-translate-y-1">
                    <FaUsers size={32} />
                    <span className="text-lg font-bold mt-2">User Access</span>
                    <span className="text-xs text-blue-200 mt-1">Manage accounts & roles</span>
                </button>
                <button onClick={() => onNavigate('audit-logs')} className="flex flex-col items-center justify-center p-6 bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-lg transition transform hover:-translate-y-1">
                    <FaShieldAlt size={32} />
                    <span className="text-lg font-bold mt-2">Audit Logs</span>
                    <span className="text-xs text-red-200 mt-1">Security & Compliance</span>
                </button>
                 <button onClick={() => onNavigate('report-generator')} className="flex flex-col items-center justify-center p-6 bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-lg transition transform hover:-translate-y-1">
                    <FaFileAlt size={32} />
                    <span className="text-lg font-bold mt-2">Reports</span>
                    <span className="text-xs text-green-200 mt-1">Financial & Operational</span>
                </button>
            </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* User Activity */}
            <div className="lg:col-span-2 space-y-8">
                <section>
                    <h2 className="text-xl font-semibold mb-4">Live System Activity</h2>
                    <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-100">
                         <ul className="divide-y divide-gray-200">
                            {activities.length > 0 ? activities.map((activity, index) => (
                                <li key={index} className="p-4 flex justify-between items-center hover:bg-gray-50 transition">
                                    <div className="flex items-center gap-3">
                                        <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold uppercase ${
                                            activity.status === 'success' ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'
                                        }`}>
                                            {activity.user.substring(0,2)}
                                        </div>
                                        <div>
                                            <span className="font-semibold block">{activity.user}</span>
                                            <span className="text-sm text-gray-500">{activity.action} - <span className="text-xs italic">{activity.details}</span></span>
                                        </div>
                                    </div>
                                    <span className="text-xs font-medium px-2 py-1 bg-gray-100 rounded text-gray-600">{formatTimeAgo(activity.timestamp)}</span>
                                </li>
                            )) : (
                                <li className="p-8 text-center text-gray-500 italic">No recent activity recorded.</li>
                            )}
                         </ul>
                         <div className="p-3 bg-gray-50 text-center">
                             <button onClick={() => onNavigate('audit-logs')} className="text-sm text-blue-600 font-medium hover:underline">View Full Audit Trail</button>
                         </div>
                    </div>
                </section>
            </div>
            {/* Revenue Reports */}
            <div className="space-y-8">
                <section>
                    <h2 className="text-xl font-semibold mb-4">Financial Overview</h2>
                    <div className="bg-white p-6 rounded-lg shadow border border-gray-100">
                        <div className="flex items-end justify-between mb-2">
                             <div>
                                <p className="text-gray-500 text-sm">Weekly Revenue</p>
                                <p className="font-bold text-3xl text-green-600">ETB {totalRevenue.toLocaleString()}</p>
                             </div>
                             <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">+12% vs last week</span>
                        </div>
                        
                        <div className="mt-6 h-40 bg-gray-50 rounded-lg flex items-end justify-around p-4 border border-gray-100">
                           {/* Dynamic chart bars */}
                           {weeklyData.map((day, idx) => (
                               <div key={idx} className="w-8 bg-green-500/80 rounded-t-md hover:bg-green-600 transition-all relative group" style={{height: day.height}}>
                                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-10">
                                        {day.day}: ETB {day.amount}
                                    </div>
                                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-medium text-gray-500">{day.day}</div>
                               </div>
                           ))}
                        </div>
                        <button onClick={() => onNavigate('report-generator')} className="w-full mt-8 py-2 text-sm text-center text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition">Download Detailed Report</button>
                    </div>
                </section>
            </div>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;