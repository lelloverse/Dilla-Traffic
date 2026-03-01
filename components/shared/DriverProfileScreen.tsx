import React, { useState, useEffect } from 'react';
import { ProfileData, UserRole, Driver } from '../../types';
import { useToast } from '../../context/ToastContext';
import { getDrivers, updateDriver } from '../../database';

interface DriverProfileScreenProps {
  profileData: ProfileData;
  userRole: UserRole;
  onBack: () => void;
}

const DriverProfileScreen: React.FC<DriverProfileScreenProps> = ({ profileData, userRole, onBack }) => {
    const { addToast } = useToast();
    const [driver, setDriver] = useState<Driver | null>(null);
    
    // Initialize state with real values from database
    const [status, setStatus] = useState<'Active' | 'Suspended' | 'Expired'>('Active');
    const [expiryDate, setExpiryDate] = useState('2025-01-14');

    useEffect(() => {
        const fetchDriver = async () => {
            const drivers = await getDrivers();
            const found = drivers.find(d => d.id === profileData.id);
            if (found) {
                setDriver(found);
                setStatus(found.status as any);
                setExpiryDate(found.expiryDate);
            }
        };
        fetchDriver();
    }, [profileData.id]);

    const handleApproveRenewal = async () => {
        if (!driver) return;

        const currentExp = new Date(expiryDate);
        const baseDate = currentExp < new Date() ? new Date() : currentExp;
        baseDate.setFullYear(baseDate.getFullYear() + 1);
        
        const newExpiryStr = baseDate.toISOString().split('T')[0];
        setExpiryDate(newExpiryStr);
        setStatus('Active');
        
        // Update DB
        await updateDriver({
            ...driver,
            expiryDate: newExpiryStr,
            status: 'Active'
        });
        
        addToast(`Renewal Approved. New Expiry: ${newExpiryStr}`, 'success');
    };

    const handleSuspendLicense = async () => {
        if (!driver) return;
        setStatus('Suspended');
        
        // Update DB
        await updateDriver({
            ...driver,
            status: 'Suspended'
        });

        addToast(`License for ${driver.fullName} has been suspended.`, 'error');
    };

    const renderActions = () => {
        switch(userRole) {
            case UserRole.Clerk:
                return <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Start Renewal Process</button>;
            case UserRole.Admin:
                return (
                    <button 
                        onClick={handleApproveRenewal} 
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                    >
                        Approve Renewal
                    </button>
                );
            default:
                return null;
        }
    }

    const getStatusColor = () => {
        if (status === 'Active') return 'text-green-500';
        if (status === 'Suspended') return 'text-red-500';
        return 'text-yellow-500';
    };

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-xl p-8 border border-gray-100">
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Driver Profile: {driver?.fullName || profileData.title}</h1>
            <button
                onClick={onBack}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
            >
                Back to Search Results
            </button>
        </div>

        <div className="space-y-4 text-gray-700">
            <p><span className="font-semibold">License Number:</span> {driver?.licenseNumber}</p>
            <p><span className="font-semibold">Phone:</span> {driver?.phone}</p>
            <p><span className="font-semibold">Email:</span> {driver?.email}</p>
            <p><span className="font-semibold">Gender:</span> {driver?.gender}</p>
            <p><span className="font-semibold">License Expiry:</span> {expiryDate}</p>
            <p><span className="font-semibold">Status:</span> <span className={`font-bold ${getStatusColor()}`}>{status}</span></p>
            {driver?.associatedVehicles && driver.associatedVehicles.length > 0 && (
                <p><span className="font-semibold">Associated Vehicles:</span> {driver.associatedVehicles.join(', ')}</p>
            )}
        </div>
        
        <div className="mt-8 pt-6 border-t border-gray-200">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Actions</h2>
            <div className="flex gap-4">
                {renderActions()}
                {(userRole === UserRole.Admin) && 
                    <button 
                        onClick={handleSuspendLicense} 
                        disabled={status === 'Suspended'}
                        className={`px-4 py-2 text-white rounded-lg transition ${status === 'Suspended' ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`}
                    >
                        {status === 'Suspended' ? 'Suspended' : 'Suspend License'}
                    </button>
                }
            </div>
        </div>

      </div>
    </div>
  );
};

export default DriverProfileScreen;