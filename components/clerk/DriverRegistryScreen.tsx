import React, { useState, useEffect } from 'react';
import { getDrivers, getVehicles, updateDriver, addAuditLog } from '../../database';
import { Driver, Vehicle } from '../../types';
import { useTranslation } from 'react-i18next';
import { FaSearch, FaFilter, FaIdCard, FaUser, FaPhone, FaCalendarAlt, FaChevronLeft, FaCar, FaPlus } from 'react-icons/fa';
import { useToast } from '../../context/ToastContext';

interface DriverRegistryScreenProps {
  onBack: () => void;
  currentUser?: {
    username: string;
    role: string;
    woredaId: string | null;
  } | null;
}

const DriverRegistryScreen: React.FC<DriverRegistryScreenProps> = ({ onBack, currentUser }) => {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterGender, setFilterGender] = useState<string>('all');
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [showAssociateModal, setShowAssociateModal] = useState(false);
  const [vehicleSearch, setVehicleSearch] = useState('');

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  useEffect(() => {
    const fetchData = async () => {
        const [d, v] = await Promise.all([
            getDrivers(),
            getVehicles()
        ]);
        setDrivers(d);
        setVehicles(v);
    };
    fetchData();
  }, []);

  const handleAssociateVehicle = async (plateNumber: string) => {
    if (!selectedDriver) return;
    
    if (selectedDriver.associatedVehicles.includes(plateNumber)) {
        addToast("Vehicle already associated with this driver", "error");
        return;
    }

    const updatedDriver: Driver = {
        ...selectedDriver,
        associatedVehicles: [...selectedDriver.associatedVehicles, plateNumber]
    };

    await updateDriver(updatedDriver);
    await addAuditLog(
      'VEHICLE_ASSOCIATED',
      `Associated vehicle ${plateNumber} to driver ${selectedDriver.fullName}`,
      currentUser?.username || 'Unknown Clerk',
      currentUser?.role || 'Clerk',
      currentUser?.woredaId || null
    );

    addToast(`Vehicle ${plateNumber} associated successfully`, "success");
    setSelectedDriver(updatedDriver); // Update local state for modal
    setDrivers(drivers.map(d => d.id === updatedDriver.id ? updatedDriver : d));
  };

  const handleRemoveVehicle = async (driver: Driver, plateNumber: string) => {
    const updatedDriver: Driver = {
        ...driver,
        associatedVehicles: driver.associatedVehicles.filter(v => v !== plateNumber)
    };

    await updateDriver(updatedDriver);
    setDrivers(drivers.map(d => d.id === updatedDriver.id ? updatedDriver : d));
    addToast(`Vehicle association removed`, "info");
  };

  const filteredVehicles = (vehicles || []).filter(v => {
    const plate = (v.plateNumber || '').toLowerCase();
    const make = (v.make || '').toLowerCase();
    const model = (v.model || '').toLowerCase();
    const search = (vehicleSearch || '').toLowerCase();

    return plate.includes(search) ||
           make.includes(search) ||
           model.includes(search);
  }).slice(0, 5); // Limit suggestions

  const filteredDrivers = drivers.filter(d => {
    const license = (d.licenseNumber || '').toLowerCase();
    const name = (d.fullName || '').toLowerCase();
    const phone = (d.phone || '').toLowerCase();
    const search = searchTerm.toLowerCase();

    const matchesSearch = 
      license.includes(search) ||
      name.includes(search) ||
      phone.includes(search);
    
    const matchesStatus = filterStatus === 'all' || d.status === filterStatus;
    const matchesGender = filterGender === 'all' || d.gender === filterGender;

    return matchesSearch && matchesStatus && matchesGender;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
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
          <h1 className="text-3xl font-bold text-gray-900">{t('driverRegistryTitle')}</h1>
          <p className="text-gray-500 mt-1">{t('driverRegistryDesc')}</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="bg-green-50 px-4 py-2 rounded-lg border border-green-100 text-center">
            <p className="text-xs text-green-600 font-bold uppercase tracking-wider">{t('totalActiveDrivers')}</p>
            <p className="text-xl font-black text-green-900">{drivers.filter(d => d.status === 'Active').length}</p>
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
            placeholder={t('searchDriversPlaceholder')}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex gap-2 w-full md:w-auto">
          <select 
            className="flex-1 md:w-48 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={filterGender}
            onChange={(e) => setFilterGender(e.target.value)}
          >
            <option value="all">{t('allGenders')}</option>
            <option value="Male">{t('male')}</option>
            <option value="Female">{t('female')}</option>
          </select>
        </div>
      </div>

      {/* Registry Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">{t('driverInfo')}</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">{t('contact')}</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">{t('status')}</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">{t('expiry')}</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">{t('associatedVehicles')}</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredDrivers.length > 0 ? (
                filteredDrivers.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600 mr-3 group-hover:bg-green-600 group-hover:text-white transition-colors">
                          <FaUser size={20} />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{d.fullName}</p>
                          <p className="text-xs text-gray-500 font-medium">{t('licenseNumber')}: {d.licenseNumber}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <div className="flex items-center text-sm font-medium text-gray-900">
                          <span className="mr-1.5 text-gray-400 flex items-center"><FaPhone size={12} /></span> {d.phone}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusColor(d.status)}`}>
                        {t(d.status.toLowerCase())}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center text-sm text-gray-600">
                        <span className="mr-2 text-gray-400 flex items-center"><FaCalendarAlt size={12} /></span>
                        {d.expiryDate}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {d.associatedVehicles.length > 0 ? (
                          d.associatedVehicles.map(v => (
                            <span key={v} className="flex items-center px-2 py-0.5 bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-[10px] font-bold border border-gray-200">
                              <span className="mr-1 opacity-60 flex items-center"><FaCar size={10} /></span> {v}
                              <button 
                                onClick={() => handleRemoveVehicle(d, v)}
                                className="ml-1.5 text-gray-400 hover:text-red-500 transition-colors"
                                title={t('removeAssociation')}
                              >
                                ×
                              </button>
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-400 italic">{t('none')}</span>
                        )}
                        <button 
                          onClick={() => {
                            setSelectedDriver(d);
                            setShowAssociateModal(true);
                            setVehicleSearch('');
                          }}
                          className="flex items-center px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-bold border border-blue-100 hover:bg-blue-600 hover:text-white transition-colors"
                        >
                          <span className="mr-1 flex items-center"><FaPlus size={8} /></span> {t('add')}
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors">
                        {t('viewDetails')}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500 italic">
                    {t('noDriversFound')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Association Modal */}
      {showAssociateModal && selectedDriver && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-scale-up">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{t('associateVehicle')}</h3>
                <p className="text-sm text-gray-500">{t('addVehicleFor', { name: selectedDriver.fullName })}</p>
              </div>
              <button 
                onClick={() => setShowAssociateModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <FaSearch size={14} />
                </span>
                <input 
                  type="text"
                  placeholder={t('searchVehiclesByPlate')}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  value={vehicleSearch}
                  onChange={(e) => setVehicleSearch(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
                {filteredVehicles.length > 0 ? (
                  filteredVehicles.map(v => (
                    <div 
                      key={v.id} 
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group"
                    >
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center text-gray-500 mr-3 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                          <FaCar size={16} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{v.plateNumber}</p>
                          <p className="text-[10px] text-gray-500">{v.make} {v.model} ({v.year})</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleAssociateVehicle(v.plateNumber)}
                        disabled={selectedDriver.associatedVehicles.includes(v.plateNumber)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          selectedDriver.associatedVehicles.includes(v.plateNumber)
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow-md'
                        }`}
                      >
                        {selectedDriver.associatedVehicles.includes(v.plateNumber) ? t('added') : t('associate')}
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center bg-gray-50 rounded-lg border border-dashed border-gray-200">
                    <p className="text-xs text-gray-400 italic">{t('noRecentTrans')}</p>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end">
                <button 
                  onClick={() => setShowAssociateModal(false)}
                  className="px-6 py-2 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200 transition"
                >
                  {t('done')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverRegistryScreen;
