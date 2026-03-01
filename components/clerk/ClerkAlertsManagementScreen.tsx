import React, { useState, useEffect } from 'react';
import { FaChevronLeft, FaExclamationTriangle, FaPlus, FaRegBell, FaMapMarkerAlt, FaCar, FaClock, FaCalendarAlt, FaTimes, FaCheck } from 'react-icons/fa';
import { getAlerts, addAlert, updateAlert } from '../../database';
import { Alert } from '../../types';
import { useToast } from '../../context/ToastContext';

interface ClerkAlertsManagementScreenProps {
  onBack: () => void;
}

const ClerkAlertsManagementScreen: React.FC<ClerkAlertsManagementScreenProps> = ({ onBack }) => {
  const { addToast } = useToast();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Form state
  const [category, setCategory] = useState<'System' | 'BOLO'>('System');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'High' | 'Medium' | 'Low'>('Medium');
  const [location, setLocation] = useState('');
  const [type, setType] = useState('');
  const [metadata, setMetadata] = useState<Record<string, string>>({ plate: '', color: '' });

  const fetchAlerts = async () => {
    setIsLoading(true);
    try {
      const data = await getAlerts();
      setAlerts(data);
    } catch (error) {
      console.error('Error fetching alerts:', error);
      addToast('Failed to load alerts', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const handleAddAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;

    try {
      await addAlert({
        category,
        title,
        description,
        priority,
        location,
        type: category === 'BOLO' ? type : 'SYSTEM ALERT',
        metadata: category === 'BOLO' ? metadata : {},
        isActive: true
      });
      addToast('Alert registered successfully', 'success');
      setShowAddModal(false);
      resetForm();
      fetchAlerts();
    } catch (error) {
      console.error('Error adding alert:', error);
      addToast('Failed to register alert', 'error');
    }
  };

  const resetForm = () => {
    setCategory('System');
    setTitle('');
    setDescription('');
    setPriority('Medium');
    setLocation('');
    setType('');
    setMetadata({ plate: '', color: '' });
  };

  const toggleAlertStatus = async (alert: Alert) => {
    try {
      await updateAlert(alert.id, { isActive: !alert.isActive });
      addToast(`Alert ${alert.isActive ? 'deactivated' : 'activated'}`, 'success');
      fetchAlerts();
    } catch (error) {
      console.error('Error updating alert:', error);
      addToast('Failed to update alert status', 'error');
    }
  };

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'High': return 'bg-red-500 text-white';
      case 'Medium': return 'bg-amber-500 text-white';
      case 'Low': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <span className="text-gray-600"><FaChevronLeft size={20} /></span>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Active Alerts</h1>
            <p className="text-gray-500">BOLO & Critical Notifications</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
             <span className="text-gray-400"><FaRegBell size={24} /></span>
             <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-white">
               {alerts.filter(a => a.isActive).length}
             </span>
          </div>
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition shadow-sm"
          >
            <FaPlus size={14} />
            <span>New Alert</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* System Alerts Section */}
          {alerts.some(a => a.category === 'System' && a.isActive) && (
            <div className="space-y-4">
              {alerts.filter(a => a.category === 'System' && a.isActive).map(alert => (
                <div key={alert.id} className="bg-gradient-to-br from-rose-500 to-red-600 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden group">
                  <div className="absolute right-[-20px] bottom-[-20px] opacity-10 group-hover:scale-110 transition-transform duration-500">
                    <FaExclamationTriangle size={200} />
                  </div>
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider mb-3 opacity-90">
                      <FaExclamationTriangle />
                      <span>{alert.type || 'SYSTEM ALERT'}</span>
                    </div>
                    <h2 className="text-2xl font-bold mb-3">{alert.title}</h2>
                    <p className="text-white/90 leading-relaxed mb-6 max-w-2xl">
                      {alert.description}
                    </p>
                    <div className="flex items-center gap-4">
                       <button 
                        onClick={() => toggleAlertStatus(alert)}
                        className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2"
                       >
                         <FaTimes size={12} />
                         Dismiss
                       </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* BOLOs Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
                <h2 className="text-xl font-bold text-gray-900">Active BOLOs</h2>
              </div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Updated {new Date().getMinutes() % 10}m ago
              </span>
            </div>

            {alerts.filter(a => a.category === 'BOLO' && a.isActive).length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {alerts.filter(a => a.category === 'BOLO' && a.isActive).map(alert => (
                  <div key={alert.id} className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-100 hover:shadow-md transition duration-300 relative overflow-hidden">
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
                          {alert.type || 'BOLO'}
                        </span>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest ${getPriorityColor(alert.priority)}`}>
                          {alert.priority}
                        </span>
                      </div>
                      <div className="flex flex-col items-end text-gray-400 text-[10px] font-bold">
                        <div className="flex items-center gap-1 mb-1">
                           <FaClock size={10} />
                           {new Date(alert.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="flex items-center gap-1">
                           <FaCalendarAlt size={10} />
                           {new Date(alert.createdAt).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase()}
                        </div>
                      </div>
                    </div>

                    <h3 className="text-2xl font-bold text-gray-900 mb-6">{alert.title}</h3>
                    
                    {alert.location && (
                      <div className="flex items-center gap-2 text-gray-400 text-xs font-bold mb-6">
                        <span className="text-gray-300"><FaMapMarkerAlt size={12} /></span>
                        <span>{alert.location}</span>
                      </div>
                    )}

                    <div className="text-gray-500 text-sm leading-relaxed mb-8">
                      {alert.description}
                      {alert.metadata?.plate && (
                        <div className="mt-2 font-medium text-gray-700">
                          Plate: {alert.metadata.plate}
                        </div>
                      )}
                    </div>

                    <button className="w-full bg-gray-50 hover:bg-gray-100 py-4 rounded-2xl text-gray-900 font-bold text-sm transition flex items-center justify-center gap-2 group">
                      View Full Details
                      <span className="rotate-180 group-hover:translate-x-1 transition-transform"><FaChevronLeft size={10} /></span>
                    </button>
                    
                    <button 
                      onClick={() => toggleAlertStatus(alert)}
                      className="absolute top-4 right-4 p-2 text-gray-300 hover:text-red-500 transition-colors"
                      title="Deactivate Alert"
                    >
                      <FaTimes size={16} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-gray-50 rounded-2xl p-12 text-center">
                <span className="text-gray-200 mx-auto mb-4 block w-fit"><FaRegBell size={48} /></span>
                <p className="text-gray-500 font-medium">No active BOLOs at the moment</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Alert Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="text-xl font-bold text-gray-900">Register New Alert</h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <span className="text-gray-400"><FaTimes size={20} /></span>
              </button>
            </div>
            
            <form onSubmit={handleAddAlert} className="p-8 space-y-6">
              {/* Category Selection */}
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Alert Category</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setCategory('System')}
                    className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${
                      category === 'System' 
                        ? 'border-red-500 bg-red-50 text-red-700' 
                        : 'border-gray-100 hover:border-gray-200 text-gray-500'
                    }`}
                  >
                    <FaExclamationTriangle size={24} />
                    <span className="font-bold text-sm">System Alert</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategory('BOLO')}
                    className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${
                      category === 'BOLO' 
                        ? 'border-blue-500 bg-blue-50 text-blue-700' 
                        : 'border-gray-100 hover:border-gray-200 text-gray-500'
                    }`}
                  >
                    <FaCar size={24} />
                    <span className="font-bold text-sm">BOLO</span>
                  </button>
                </div>
              </div>

              {/* Title & Type */}
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Title</label>
                  <input 
                    type="text" 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={category === 'System' ? 'e.g. Severe Weather Warning' : 'e.g. 2022 White Honda Civic'}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                    required
                  />
                </div>
                {category === 'BOLO' && (
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">BOLO Type</label>
                    <input 
                      type="text" 
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                      placeholder="e.g. STOLEN VEHICLE"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium uppercase"
                    />
                  </div>
                )}
              </div>

              {/* Priority & Location */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Priority</label>
                  <select 
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Location</label>
                  <input 
                    type="text" 
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Highway 4"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Description / Details</label>
                <textarea 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Provide more details about the alert..."
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium resize-none"
                />
              </div>

              {/* BOLO Metadata */}
              {category === 'BOLO' && (
                <div className="bg-blue-50 p-6 rounded-2xl space-y-4">
                  <label className="block text-xs font-bold text-blue-400 uppercase tracking-widest">Additional BOLO Info</label>
                  <div className="grid grid-cols-2 gap-4">
                    <input 
                      type="text" 
                      placeholder="Plate Number"
                      value={metadata.plate}
                      onChange={(e) => setMetadata({ ...metadata, plate: e.target.value })}
                      className="w-full px-4 py-2 bg-white border border-blue-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm font-medium"
                    />
                    <input 
                      type="text" 
                      placeholder="Vehicle Color"
                      value={metadata.color}
                      onChange={(e) => setMetadata({ ...metadata, color: e.target.value })}
                      className="w-full px-4 py-2 bg-white border border-blue-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm font-medium"
                    />
                  </div>
                </div>
              )}

              <div className="pt-4">
                <button 
                  type="submit"
                  className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
                >
                  <FaCheck />
                  Register Alert
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClerkAlertsManagementScreen;