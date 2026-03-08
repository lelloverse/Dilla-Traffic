import React, { useState, useEffect } from 'react';
import { getViolations, updateViolation, bulkMarkViolationsAsPaid, addPayment, addAuditLog } from '../../database';
import { Violation, Payment } from '../../types';
import { useTranslation } from 'react-i18next';
import { 
  FaSearch, FaChevronLeft, FaCreditCard, 
  FaUndo, FaCalendarAlt, FaUser, FaCar
} from 'react-icons/fa';
import { useToast } from '../../context/ToastContext';

interface ViolationManagementScreenProps {
  onBack: () => void;
}

const ViolationManagementScreen: React.FC<ViolationManagementScreenProps> = ({ onBack }) => {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedViolation, setSelectedViolation] = useState<Violation | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');

  const [violations, setViolations] = useState<Violation[]>([]);

  useEffect(() => {
    const fetchViolations = async () => {
        const data = await getViolations();
        setViolations(data);
    };
    fetchViolations();
  }, []);

  const filteredViolations = violations.filter(v => {
    const matchesSearch = 
      v.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.driverName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.licenseNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.plateNumber.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || v.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'Paid': return 'bg-green-100 text-green-700 border-green-200';
      case 'Unpaid': return 'bg-red-100 text-red-700 border-red-200';
      case 'Overdue': return 'bg-red-600 text-white border-red-700 animate-pulse';
      case 'Partial': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredViolations.map(v => v.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkPay = async () => {
    if (selectedIds.length === 0) return;
    await bulkMarkViolationsAsPaid(selectedIds);
    const updatedViolations = await getViolations();
    setViolations(updatedViolations);
    addToast(t('bulkProcessSuccess', { count: selectedIds.length }), 'success');
    setSelectedIds([]);
  };

  const handleUndoPayment = async (v: Violation) => {
    if (v.status === 'Unpaid') return;

    const updated: Violation = {
      ...v,
      status: 'Unpaid',
      amountPaid: 0,
      paymentHistory: []
    };

    await updateViolation(updated);

    await addAuditLog({
        user: 'clerk',
        role: 'Clerk',
        action: 'Payment Undone',
        details: `Reverted payments for violation ${v.id}. Status set back to Unpaid.`,
        ipAddress: '127.0.0.1',
        status: 'success'
    });
    
    const updatedViolations = await getViolations();
    setViolations(updatedViolations);

    addToast(t('violationResetInfo', { id: v.id }), "info");
  };

  const handleProcessPayment = async () => {
    if (!selectedViolation || paymentAmount <= 0) return;

    const newAmountPaid = selectedViolation.amountPaid + paymentAmount;
    const isFullyPaid = newAmountPaid >= selectedViolation.amount;

    const updated: Violation = {
      ...selectedViolation,
      amountPaid: isFullyPaid ? selectedViolation.amount : newAmountPaid,
      status: isFullyPaid ? 'Paid' : 'Partial',
      paymentHistory: [
        ...selectedViolation.paymentHistory,
        {
          amount: paymentAmount,
          date: new Date().toISOString().split('T')[0],
          method: paymentMethod,
          transactionId: 'TXN-' + Math.random().toString(36).substr(2, 9).toUpperCase()
        }
      ]
    };

    await updateViolation(updated);

    // Add to revenue
    const newPayment: any = { 
      id: 'RCP-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
      payerName: selectedViolation.driverName,
      serviceType: 'traffic_fine',
      amount: paymentAmount,
      paymentMethod: paymentMethod.toLowerCase() as any,
      date: new Date().toISOString().split('T')[0]
    };
    await addPayment(newPayment);

    const updatedViolations = await getViolations();
    setViolations(updatedViolations);
    addToast(t('paymentRecordedSuccess', { amount: paymentAmount, id: selectedViolation.id }), 'success');
    setShowPaymentModal(false);
    setSelectedViolation(null);
    setPaymentAmount(0);
  };

  return (
    <div className="p-4 md:p-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 border-b pb-4 border-gray-200">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('trafficViolationsTitle')}</h1>
          <p className="text-gray-500 mt-1">{t('manageViolationsDesc')}</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="bg-red-50 px-4 py-2 rounded-lg border border-red-100 text-center">
            <p className="text-xs text-red-600 font-bold uppercase tracking-wider">{t('unpaidTotal')}</p>
            <p className="text-xl font-black text-red-900">
              ETB {violations.filter(v => v.status !== 'Paid').reduce((sum, v) => sum + (v.amount - v.amountPaid), 0).toLocaleString()}
            </p>
          </div>
          <button 
            onClick={onBack}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
          >
            {t('backToDashboard')}
          </button>
        </div>
      </div>

      {/* Filters & Bulk Actions */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 flex items-center">
              <FaSearch />
            </span>
            <input 
              type="text"
              placeholder={t('searchViolationsPlaceholder')}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2 w-full md:w-auto">
            <select 
              className="flex-1 md:w-48 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">{t('allStatuses')}</option>
              <option value="Paid">{t('paid')}</option>
              <option value="Unpaid">{t('unpaid')}</option>
              <option value="Partial">{t('partial')}</option>
              <option value="Overdue">{t('overdue')}</option>
            </select>
          </div>
        </div>

        {selectedIds.length > 0 && (
          <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-lg animate-fade-in">
            <p className="text-sm text-blue-700 font-medium">
              <span className="font-bold">{t('violationsSelected', { count: selectedIds.length })}</span>
            </p>
            <button 
              onClick={handleBulkPay}
              className="px-4 py-1.5 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition"
            >
              {t('markSelectedAsPaid')}
            </button>
          </div>
        )}
      </div>

      {/* Violations Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4">
                  <input 
                    type="checkbox" 
                    className="rounded text-blue-600 focus:ring-blue-500"
                    onChange={handleSelectAll}
                    checked={selectedIds.length === filteredViolations.length && filteredViolations.length > 0}
                  />
                </th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">{t('violationAndDate')}</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">{t('driverVehicle')}</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">{t('amount')}</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">{t('status')}</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredViolations.length > 0 ? (
                filteredViolations.map((v) => (
                  <tr key={v.id} className={`hover:bg-gray-50 transition-colors ${selectedIds.includes(v.id) ? 'bg-blue-50/30' : ''}`}>
                    <td className="px-6 py-4">
                      <input 
                        type="checkbox" 
                        className="rounded text-blue-600 focus:ring-blue-500"
                        checked={selectedIds.includes(v.id)}
                        onChange={() => handleToggleSelect(v.id)}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-bold text-gray-900">{v.violationType}</p>
                        <p className="text-xs text-gray-500 font-mono">{v.id}</p>
                        <div className="flex items-center text-[10px] text-gray-400 mt-1">
                          <span className="mr-1 flex items-center"><FaCalendarAlt /></span> Issued: {v.issueDate}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center text-sm font-medium text-gray-900">
                          <span className="mr-1.5 text-gray-400 flex items-center"><FaUser size={12} /></span> {v.driverName}
                        </div>
                        <div className="flex items-center text-xs text-gray-500">
                          <span className="mr-1.5 text-gray-400 flex items-center"><FaCar size={12} /></span> {v.plateNumber}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-bold text-gray-900">ETB {v.amount}</p>
                        {v.amountPaid > 0 && (
                          <p className="text-[10px] text-green-600">Paid: ETB {v.amountPaid}</p>
                        )}
                        <p className="text-[10px] text-gray-400">Due: {v.dueDate}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${getStatusStyle(v.status)}`}>
                        {t(v.status.toLowerCase())}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {v.status !== 'Paid' && (
                          <button 
                            onClick={() => {
                              setSelectedViolation(v);
                              setPaymentAmount(v.amount - v.amountPaid);
                              setShowPaymentModal(true);
                            }}
                            className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-colors"
                            title={t('recordPayment')}
                          >
                            <FaCreditCard size={14} />
                          </button>
                        )}
                        <button 
                          className={`p-2 rounded-lg transition-colors ${v.status === 'Unpaid' ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-50 text-orange-600 hover:bg-orange-600 hover:text-white'}`}
                          title={t('undoPayment')}
                          disabled={v.status === 'Unpaid'}
                          onClick={() => handleUndoPayment(v)}
                        >
                          <FaUndo size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500 italic">
                    {t('noViolationsFound')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && selectedViolation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">{t('recordPayment')}</h3>
              <button 
                onClick={() => setShowPaymentModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-500">{t('violationId')}</span>
                <span className="text-sm font-mono font-bold">{selectedViolation.id}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-500">{t('totalAmount')}</span>
                <span className="text-sm font-bold">ETB {selectedViolation.amount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">{t('remaining')}</span>
                <span className="text-sm font-bold text-red-600">ETB {selectedViolation.amount - selectedViolation.amountPaid}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t('amountEtb')}</label>
                <input 
                  type="number"
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value))}
                  max={selectedViolation.amount - selectedViolation.amountPaid}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('paymentMethod')}</label>
                <select 
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="Cash">{t('cash')}</option>
                  <option value="Card">{t('card')}</option>
                  <option value="Bank Transfer">{t('bankTransfer')}</option>
                  <option value="Mobile Money">{t('mobileMoney')}</option>
                </select>
              </div>
              <button 
                onClick={handleProcessPayment}
                className="w-full py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition"
              >
                {t('confirmPayment')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ViolationManagementScreen;
