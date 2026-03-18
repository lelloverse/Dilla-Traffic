import React, { useState, useEffect } from 'react';
import { ProfileData, UserRole, Driver, Vehicle } from '../../types';
import { getVehicles, getDrivers, transferVehicleOwnership } from '../../database';
import { FaExclamationTriangle, FaSearch, FaUser, FaIdCard, FaChevronRight } from 'react-icons/fa';
import { useToast } from '../../context/ToastContext';

interface VehicleProfileScreenProps {
  profileData: ProfileData;
  userRole: UserRole;
  onBack: () => void;
}

const VehicleProfileScreen: React.FC<VehicleProfileScreenProps> = ({ profileData, userRole, onBack }) => {
    const { addToast } = useToast();
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [driverSearch, setDriverSearch] = useState('');
    
    // Use state for local UI update after transfer
    const [localVehicles, setLocalVehicles] = useState<Vehicle[]>([]);
    const [allDrivers, setAllDrivers] = useState<Driver[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            const [v, d] = await Promise.all([
                getVehicles(),
                getDrivers()
            ]);
            setLocalVehicles(v);
            setAllDrivers(d);
        };
        fetchData();
    }, []);

    const vehicle = localVehicles.find(v => v.id === profileData.id);
    const isStolen = vehicle?.stolenStatus?.isStolen;

    const filteredDrivers = driverSearch.length >= 2 
        ? allDrivers.filter(d => 
            d.fullName.toLowerCase().includes(driverSearch.toLowerCase()) || 
            d.licenseNumber.toLowerCase().includes(driverSearch.toLowerCase())
          ).slice(0, 5)
        : [];

    const handleTransfer = async (newOwner: Driver) => {
        if (!vehicle) return;
        
        if (newOwner.fullName === vehicle.ownerName) {
            addToast("This driver is already the owner of this vehicle.", "info");
            return;
        }

        await transferVehicleOwnership(vehicle.id, newOwner);
        const updatedVehicles = await getVehicles();
        setLocalVehicles(updatedVehicles); // Refresh local data
        setShowTransferModal(false);
        setDriverSearch('');
        addToast(`Vehicle ${vehicle.plateNumber} successfully transferred to ${newOwner.fullName}.`, "success");
    };

    const renderActions = () => {
        switch(userRole) {
            case UserRole.Clerk:
                return null; // Removed Schedule Inspection as requested
            case UserRole.Admin:
                return <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Log Inspection Result</button>;
            default:
                return null; 
        }
    }

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-xl p-8 border border-gray-100 relative">
        {isStolen && (
          <div className="bg-red-600 text-white p-4 rounded-lg mb-6 flex items-center animate-pulse">
            <span className="mr-4 flex items-center"><FaExclamationTriangle size={32} /></span>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tighter">Warning: This Vehicle is Reported STOLEN</h2>
              <p className="text-sm opacity-90">Reported on {new Date(vehicle?.stolenStatus?.reportedAt || '').toLocaleString()} by {vehicle?.stolenStatus?.reportedBy}</p>
            </div>
          </div>
        )}
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Vehicle Profile: {vehicle?.plateNumber || profileData.title}</h1>
            <button
                onClick={onBack}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
            >
                Back to Search Results
            </button>
        </div>

        <div className="space-y-4 text-gray-700">
            <p><span className="font-semibold">Model:</span> {vehicle?.make} {vehicle?.model} {vehicle?.year}</p>
            <p><span className="font-semibold">Owner:</span> {vehicle?.ownerName}</p>
            <p><span className="font-semibold">Owner Phone:</span> {vehicle?.ownerPhone}</p>
            <p><span className="font-semibold">Expiry Date:</span> {vehicle?.expiryDate}</p>
            <p><span className="font-semibold">Type:</span> <span className="capitalize">{vehicle?.type}</span></p>
            <p><span className="font-semibold">Status:</span> 
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-bold ${isStolen ? 'bg-red-600 text-white' : vehicle?.status === 'Active' ? 'text-green-500 bg-green-50 border border-green-200' : 'text-yellow-500 bg-yellow-50 border border-yellow-200'}`}>
                {isStolen ? 'STOLEN' : vehicle?.status}
              </span>
            </p>
        </div>
        
        <div className="mt-8 pt-6 border-t border-gray-200">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Actions</h2>
            <div className="flex gap-4">
                {renderActions()}
                {(userRole === UserRole.Clerk || userRole === UserRole.Admin) && 
                    <button 
                        onClick={() => setShowTransferModal(true)}
                        className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition"
                    >
                        Transfer Ownership
                    </button>
                }
            </div>
        </div>

        {/* Transfer Ownership Modal */}
        {showTransferModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
                <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 animate-scale-in">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Transfer Ownership</h3>
                    <p className="text-gray-500 mb-6">Search and select the new owner for vehicle <span className="font-bold text-gray-800">{vehicle?.plateNumber}</span>.</p>
                    
                    <div className="relative mb-6">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                            <FaSearch size={14} />
                        </div>
                        <input 
                            type="text"
                            placeholder="Search by driver name or license #..."
                            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-500 transition-all text-sm"
                            value={driverSearch}
                            onChange={(e) => setDriverSearch(e.target.value)}
                            autoFocus
                        />
                    </div>

                    <div className="space-y-2 mb-8 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                        {filteredDrivers.length > 0 ? (
                            filteredDrivers.map(driver => (
                                <button
                                    key={driver.id}
                                    onClick={() => handleTransfer(driver)}
                                    className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-yellow-50 rounded-xl border border-gray-100 hover:border-yellow-200 transition-all group"
                                >
                                    <div className="flex items-center">
                                        <div className="p-2 bg-white rounded-lg text-gray-400 group-hover:text-yellow-600 transition-colors mr-3">
                                            <FaUser size={16} />
                                        </div>
                                        <div className="text-left">
                                            <p className="font-bold text-gray-900 text-sm">{driver.fullName}</p>
                                            <div className="flex items-center text-xs text-gray-500 mt-0.5">
                                                <span className="mr-1 flex items-center"><FaIdCard size={10} /></span> {driver.licenseNumber}
                                            </div>
                                        </div>
                                    </div>
                                    <span className="text-gray-300 group-hover:text-yellow-500 transition-colors flex items-center"><FaChevronRight size={12} /></span>
                                </button>
                            ))
                        ) : driverSearch.length >= 2 ? (
                            <div className="text-center py-8 text-gray-400 italic text-sm">
                                No drivers found matching "{driverSearch}"
                            </div>
                        ) : (
                            <div className="text-center py-8 text-gray-400 text-sm">
                                Type at least 2 characters to search...
                            </div>
                        )}
                    </div>

                    <div className="flex gap-3">
                        <button 
                            onClick={() => {
                                setShowTransferModal(false);
                                setDriverSearch('');
                            }}
                            className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-all text-sm"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default VehicleProfileScreen;
