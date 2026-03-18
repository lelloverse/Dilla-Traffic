import React, { useState, useEffect } from 'react';
import { getPlates, getPayments, getVehicles, getDrivers, getViolations } from '../../database';
import { useTranslation } from 'react-i18next';
import { FaCar, FaIdCard, FaArrowRight, FaExclamationTriangle, FaFileInvoiceDollar } from 'react-icons/fa';
import { MdPayments, MdInventory } from 'react-icons/md';
import { BiSolidCarGarage } from 'react-icons/bi';
import { FiClock, FiCheckCircle } from 'react-icons/fi';
import { Vehicle, Driver, PlateItem, Payment, Violation, UserRole, ClerkView } from '../../types';

interface ClerkDashboardProps {
  onNavigate: (view: ClerkView) => void;
  userRole: UserRole;
}

const MetricCard: React.FC<{ 
  title: string; 
  value: string; 
  subtitle: string; 
  icon: React.ReactNode;
  warningCount?: number;
}> = ({ title, value, subtitle, icon, warningCount }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm flex items-start space-x-4 border border-gray-200 relative overflow-hidden">
    <div className="p-3 bg-gray-50 rounded-lg">
      {icon}
    </div>
    <div>
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <div className="flex items-baseline space-x-2">
        <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        {warningCount !== undefined && warningCount > 0 && (
          <span className="flex items-center text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
            <span className="mr-1 flex items-center"><FaExclamationTriangle size={10} /></span>
            {warningCount}
          </span>
        )}
      </div>
      <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
    </div>
    {warningCount !== undefined && warningCount > 0 && (
      <div className="absolute top-0 right-0 w-1 h-full bg-amber-400"></div>
    )}
  </div>
);

const ModuleCard: React.FC<{ title: string; description: string; btnText: string; icon: React.ReactNode; onClick: () => void }> = ({ title, description, btnText, icon, onClick }) => (
  <div 
    onClick={onClick}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick();
      }
    }}
    tabIndex={0}
    role="button"
    className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition duration-200 flex flex-col justify-between h-full cursor-pointer group/card focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
  >
    <div>
      <div className="mb-4 bg-gray-50 w-16 h-16 rounded-xl flex items-center justify-center group-hover/card:bg-blue-50 transition-colors duration-200">
        {icon}
      </div>
      <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 mb-6">{description}</p>
    </div>
    <div className="flex items-center text-sm font-semibold text-gray-900">
      {btnText}
      <span className="ml-2 transition-transform group-hover/card:translate-x-1">
        <FaArrowRight size={16} />
      </span>
    </div>
  </div>
);

const ClerkDashboard: React.FC<ClerkDashboardProps> = ({ onNavigate, userRole }) => {
  const { t } = useTranslation();
  const isOfficer = userRole === UserRole.Officer;
  
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [plates, setPlates] = useState<PlateItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const fetchData = async () => {
        try {
            const [v, d, pl, py, vio] = await Promise.all([
                getVehicles(),
                getDrivers(),
                getPlates(),
                getPayments(),
                getViolations()
            ]);
            setVehicles(v);
            setDrivers(d);
            setPlates(pl);
            setPayments(py);
            setViolations(vio);
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setIsLoading(false);
        }
    };
    fetchData();
  }, []);
  
  if (isLoading) {
    return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
    );
  }

  const recentPayments = payments.slice().reverse();

  // Calculate stats
  const paidViolationsCount = violations.filter(v => v.status === 'Paid').length;
  const totalRevenueAmount = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  // Calculate expiring soon (within 30 days) for warnings
  const isExpiringSoon = (dateStr: string) => {
    const expiryDate = new Date(dateStr);
    const today = new Date();
    const diffTime = expiryDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 30;
  };

  const expiringVehicles = vehicles.filter(v => isExpiringSoon(v.expiryDate)).length;
  const expiringDrivers = drivers.filter(d => isExpiringSoon(d.expiryDate)).length;

  return (
    <div className="text-gray-900 p-4 md:p-8">
      
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">{t('dashboardTitle')}</h1>
        <p className="text-gray-500 mt-2">{t('dashboardSubtitle')}</p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <MetricCard 
          title={t('activeVehicles')} 
          value={String(vehicles.length)} 
          subtitle={t('totalRegisteredVehicles')}
          icon={<FaCar size={32} color="#2563eb" />} 
          warningCount={expiringVehicles}
        />
        <MetricCard 
          title={t('licensedDrivers')} 
          value={String(drivers.length)} 
          subtitle={t('totalActiveDrivers')}
          icon={<FaIdCard size={32} color="#16a34a" />} 
          warningCount={expiringDrivers}
        />
        <MetricCard 
          title={t('paidTrafficFines')} 
          value={String(paidViolationsCount)} 
          subtitle={t('totalPaidFines')}
          icon={<FiCheckCircle size={32} color="#16a34a" />} 
        />
        <MetricCard 
          title={t('totalRevenue')} 
          value={`ETB ${totalRevenueAmount.toLocaleString()}`} 
          subtitle={t('allTimeRevenue')}
          icon={<MdPayments size={32} color="#ca8a04" />} 
        />
      </div>

      {/* System Modules Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">{t('systemModules')}</h2>
        <p className="text-gray-500 text-sm">{t('accessModules')}</p>
      </div>

      {/* Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {!isOfficer && (
          <>
            <ModuleCard 
              title={t('vehicleRegistration')}
              description={t('vehicleRegDesc')}
              btnText={t('accessModule')}
              icon={<FaCar size={32} color="#3b82f6" />}
              onClick={() => onNavigate('new-vehicle')}
            />
            <ModuleCard 
              title={t('driverLicensing')}
              description={t('driverLicensingDesc')}
              btnText={t('accessModule')}
              icon={<FaIdCard size={32} color="#22c55e" />}
              onClick={() => onNavigate('new-license')}
            />
            <ModuleCard 
              title={t('plateManagement')}
              description={t('plateMgmtDesc')}
              btnText={t('accessModule')}
              icon={<BiSolidCarGarage size={32} color="#4f46e5" />}
              onClick={() => onNavigate('plates')}
            />
            <ModuleCard 
              title={t('paymentsRevenue')}
              description={t('paymentsDesc')}
              btnText={t('accessModule')}
              icon={<MdPayments size={32} color="#ca8a04" />}
              onClick={() => onNavigate('payments')}
            />
          </>
        )}
        <ModuleCard 
          title={t('trafficViolations')}
          description={isOfficer ? t('trafficViolationsOfficerDesc') : t('trafficViolationsClerkDesc')}
          btnText={t('accessModule')}
          icon={<FaFileInvoiceDollar size={32} color="#ef4444" />}
          onClick={() => onNavigate('violations')}
        />
        <ModuleCard 
          title={t('vehicleStock')}
          description={t('vehicleStockDesc')}
          btnText={t('accessModule')}
          icon={<FaCar size={32} color="#2563eb" />}
          onClick={() => onNavigate('vehicles')}
        />
        <ModuleCard 
          title={t('driverStock')}
          description={t('driverStockDesc')}
          btnText={t('accessModule')}
          icon={<FaIdCard size={32} color="#16a34a" />}
          onClick={() => onNavigate('drivers')}
        />
        <ModuleCard 
          title={t('alertsManagement')}
          description={t('alertsDesc')}
          btnText={t('accessModule')}
          icon={<FaExclamationTriangle size={32} color="#ef4444" />}
          onClick={() => onNavigate('alerts')}
        />
      </div>

      {/* Recent Transactions */}
      <div className="mb-12">
        <h2 className="text-xl font-bold text-gray-900 mb-4">{t('recentTransactions')}</h2>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200 sticky top-0 z-10">
                        <tr>
                            <th className="px-6 py-3">{t('payerName')}</th>
                            <th className="px-6 py-3">{t('serviceType')}</th>
                            <th className="px-6 py-3">{t('date')}</th>
                            <th className="px-6 py-3 text-right">{t('amount')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {recentPayments.length > 0 ? (
                            recentPayments.map((payment) => (
                                <tr key={payment.id} className="hover:bg-gray-50 transition">
                                    <td className="px-6 py-4 font-medium text-gray-900">{payment.payerName}</td>
                                    <td className="px-6 py-4 capitalize">{payment.serviceType.replace(/_/g, ' ')}</td>
                                    <td className="px-6 py-4 text-gray-500">{payment.date}</td>
                                    <td className="px-6 py-4 text-right font-bold text-gray-900">ETB {payment.amount.toLocaleString()}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-gray-500 italic">
                                    {t('noRecentTrans')}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
      </div>
      
      {/* Help Section */}
      <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between">
         <div>
             <h3 className="text-lg font-bold text-gray-900 mb-1">{t('needHelp')}</h3>
             <p className="text-sm text-gray-600">{t('helpDesc')}</p>
         </div>
         <div className="flex gap-4 mt-4 md:mt-0">
             <button className="px-4 py-2 bg-white text-gray-800 rounded-lg shadow-sm text-sm font-medium hover:bg-gray-50 transition">{t('documentation')}</button>
             <button className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow-sm text-sm font-medium hover:bg-blue-700 transition">{t('contactSupport')}</button>
         </div>
      </div>

    </div>
  );
};

export default ClerkDashboard;