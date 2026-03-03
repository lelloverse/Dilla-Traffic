import React, { useState, useEffect } from 'react';
import { getVehicles, markVehicleAsStolen, unmarkVehicleAsStolen, getUsers } from '../../database';
import { Vehicle } from '../../types';
import { useTranslation } from 'react-i18next';
import { FaSearch, FaFilter, FaCar, FaUser, FaPhone, FaCalendarAlt, FaChevronLeft, FaExclamationTriangle, FaShieldAlt } from 'react-icons/fa';
import { useToast } from '../../context/ToastContext';

interface VehicleRegistryScreenProps {
  onBack: () => void;
}

const VehicleRegistryScreen: React.FC<VehicleRegistryScreenProps> = ({ onBack }) => {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [showStolenModal, setShowStolenModal] = useState(false);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  useEffect(() => {
    const fetchVehicles = async () => {
        const data = await getVehicles();
        setVehicles(data);
    };
    fetchVehicles();
  }, []);

  const handleToggleStolen = async (vehicle: Vehicle) => {
    const currentUser = 'Clerk'; // In a real app, get from auth context
    const wasStolen = vehicle.stolen_status?.isStolen;

    try {
      if (wasStolen) {
        await unmarkVehicleAsStolen(vehicle.id);
        addToast(`Vehicle ${vehicle.plateNumber} unmarked as stolen`, 'success');
      } else {
        await markVehicleAsStolen(vehicle.id, currentUser);
        addToast(`Vehicle ${vehicle.plateNumber} marked as STOLEN`, 'error');
      }

      // On success, update state locally to avoid a full refetch
      setVehicles(currentVehicles =>
        currentVehicles.map(v => {
          if (v.id === vehicle.id) {
            return {
              ...v,
              stolen_status: wasStolen
                ? { ...v.stolen_status!, isStolen: false }
                : { isStolen: true, reportedBy: currentUser, reportedAt: new Date().toISOString() }
            };
          }
          return v;
        })
      );
    } catch (error) {
      console.error("Failed to update stolen status:", error);
      addToast('Failed to update vehicle status. Please try again.', 'error');
    } finally {
      setShowStolenModal(false);
      setSelectedVehicle(null);
    }
  };

  const filteredVehicles = (vehicles || []).filter(v => {
    const plate = (v.plateNumber || '').toLowerCase();
    const owner = (v.ownerName || '').toLowerCase();
    const make = (v.make || '').toLowerCase();
    const model = (v.model || '').toLowerCase();
    const search = (searchTerm || '').toLowerCase();

    const matchesSearch = 
      plate.includes(search) ||
      owner.includes(search) ||
      make.includes(search) ||
      model.includes(search);
    
    const matchesType = filterType === 'all' || v.type === filterType;
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'Stolen' ? v.stolen_status?.isStolen : v.status === filterStatus);

    return matchesSearch && matchesType && matchesStatus;
  });

  const getStatusColor = (v: Vehicle) => {
    if (v.stolen_status?.isStolen) return 'bg-red-600 text-white border-red-700 animate-pulse';
    switch (v.status) {
      case 'Active': return 'bg-green-100 text-green-700 border-green-200';
      case 'Expired': return 'bg-red-100 text-red-700 border-red-200';
      case 'Suspended': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="p-4 md:p-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 border-b pb-4 border-gray-200">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Vehicle Registry</h1>
          <p className="text-gray-500 mt-1">Maintains records of all vehicles and detailed registration information</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="bg-blue-50 px-4 py-2 rounded-lg border border-blue-100">
              <p className="text-xs text-blue-600 font-bold uppercase tracking-wider">{t('activeVehicles')}</p>
              <p className="text-xl font-black text-blue-900">{vehicles.filter(v => v.status === 'Active').length}</p>
            </div>
            <div className="bg-red-50 px-4 py-2 rounded-lg border border-red-100">
              <p className="text-xs text-red-600 font-bold uppercase tracking-wider">{t('expired')}</p>
              <p className="text-xl font-black text-red-900">{vehicles.filter(v => v.status === 'Expired').length}</p>
            </div>
          </div>
          <button 
            onClick={onBack}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
          >
            {t('backToDashboard')}
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 flex items-center">
            <FaSearch />
          </span>
          <input 
            type="text"
            placeholder="Search by plate, owner, make..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex gap-2 w-full md:w-auto">
          <select 
            className="flex-1 md:w-40 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">All Types</option>
            <option value="private">Private</option>
            <option value="commercial">Commercial</option>
            <option value="motorcycle">Motorcycle</option>
            <option value="truck">Truck</option>
            <option value="bus">Bus</option>
          </select>

          <select 
            className="flex-1 md:w-40 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="Active">Active</option>
            <option value="Expired">Expired</option>
            <option value="Suspended">Suspended</option>
            <option value="Stolen" className="text-red-600 font-bold">STOLEN</option>
          </select>
        </div>
      </div>

      {/* Registry Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Vehicle Info</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Owner</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Expiry</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredVehicles.length > 0 ? (
                filteredVehicles.map((v) => (
                  <tr key={v.id} className={`hover:bg-gray-50 transition-colors group ${v.stolen_status?.isStolen ? 'bg-red-50/30' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center mr-3 transition-colors ${v.stolen_status?.isStolen ? 'bg-red-600 text-white animate-bounce' : 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white'}`}>
                          {v.stolen_status?.isStolen ? <FaExclamationTriangle size={20} /> : <FaCar size={20} />}
                        </div>
                        <div>
                          <p className={`font-bold ${v.stolen_status?.isStolen ? 'text-red-700' : 'text-gray-900'}`}>
                            {v.plateNumber}
                            {v.stolen_status?.isStolen && <span className="ml-2 text-[10px] bg-red-600 text-white px-1.5 py-0.5 rounded-full animate-pulse">STOLEN</span>}
                          </p>
                          <p className="text-xs text-gray-500">{v.year} {v.make} {v.model}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <div className="flex items-center text-sm font-medium text-gray-900">
                          <span className="mr-1.5 text-gray-400 flex items-center"><FaUser size={12} /></span> {v.ownerName}
                        </div>
                        <div className="flex items-center text-xs text-gray-500 mt-1">
                          <span className="mr-1.5 text-gray-400 flex items-center"><FaPhone size={10} /></span> {v.ownerPhone}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600 capitalize">{v.type}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusColor(v)}`}>
                        {v.stolen_status?.isStolen ? 'STOLEN' : v.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center text-sm text-gray-600">
                        <span className="mr-2 text-gray-400 flex items-center"><FaCalendarAlt size={12} /></span>
                        {v.expiryDate}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => {
                            setSelectedVehicle(v);
                            setShowStolenModal(true);
                          }}
                          title={v.stolen_status?.isStolen ? "Mark as Recovered" : "Flag as Stolen"}
                          className={`p-2 rounded-lg transition-colors ${v.stolen_status?.isStolen ? 'bg-green-50 text-green-600 hover:bg-green-600 hover:text-white' : 'bg-red-50 text-red-600 hover:bg-red-600 hover:text-white'}`}
                        >
                          {v.stolen_status?.isStolen ? <FaShieldAlt size={16} /> : <FaExclamationTriangle size={16} />}
                        </button>
                        <button className="text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors">
                          Stolen
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500 italic">
                    No vehicles found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stolen Confirmation Modal */}
      {showStolenModal && selectedVehicle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-scale-in">
            <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4 ${selectedVehicle.stolen_status?.isStolen ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
              {selectedVehicle.stolen_status?.isStolen ? <FaShieldAlt size={32} /> : <FaExclamationTriangle size={32} />}
            </div>
            <h3 className="text-xl font-bold text-center text-gray-900 mb-2">
              {selectedVehicle.stolen_status?.isStolen ? 'Vehicle Recovered?' : 'Report Stolen Vehicle?'}
            </h3>
            <p className="text-gray-500 text-center mb-6">
              {selectedVehicle.stolen_status?.isStolen 
                ? `Are you sure you want to unmark vehicle ${selectedVehicle.plateNumber} as stolen? This will restore its previous status.`
                : `Are you sure you want to mark vehicle ${selectedVehicle.plateNumber} as STOLEN? This status will be visible to all authorized personnel.`}
            </p>
            
            {selectedVehicle.stolen_status?.isStolen && (
              <div className="bg-gray-50 p-3 rounded-lg mb-6 text-xs text-gray-600">
                <p><strong>Reported At:</strong> {new Date(selectedVehicle.stolen_status.reportedAt || '').toLocaleString()}</p>
                <p><strong>Reported By:</strong> {selectedVehicle.stolen_status.reportedBy}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button 
                onClick={() => {
                  setShowStolenModal(false);
                  setSelectedVehicle(null);
                }}
                className="flex-1 py-2 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200 transition"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleToggleStolen(selectedVehicle)}
                className={`flex-1 py-2 text-white font-bold rounded-lg transition ${selectedVehicle.stolen_status?.isStolen ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
              >
                {selectedVehicle.stolen_status?.isStolen ? 'Confirm Recovery' : 'Confirm Stolen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VehicleRegistryScreen;
