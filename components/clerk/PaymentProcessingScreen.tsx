import React, { useState, useEffect } from 'react';
import { addPayment, getPayments } from '../../database';
import { Payment } from '../../types';
import { useToast } from '../../context/ToastContext';

interface PaymentProcessingScreenProps {
  onBack: () => void;
}

const PaymentProcessingScreen: React.FC<PaymentProcessingScreenProps> = ({ onBack }) => {
    const { addToast } = useToast();
    const [recentPayments, setRecentPayments] = useState<Payment[]>([]);
    const [formData, setFormData] = useState<Payment>({
        id: 'RCP-' + new Date().getFullYear() + '-' + Math.floor(Math.random() * 10000),
        payerName: '',
        serviceType: 'vehicle_registration',
        amount: 0,
        paymentMethod: 'cash',
        date: new Date().toISOString().split('T')[0],
        notes: ''
    });

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [touched, setTouched] = useState<Record<string, boolean>>({});

    useEffect(() => {
        const fetchPayments = async () => {
            const data = await getPayments();
            setRecentPayments(data.slice(-5).reverse());
        };
        fetchPayments();
    }, []);

    const validateField = (name: string, value: any): string => {
        let error = '';
        switch(name) {
            case 'payerName':
                if (!value.trim()) error = 'Payer name is required';
                break;
            case 'amount':
                if (!value || parseFloat(value) <= 0) error = 'Amount must be greater than 0';
                break;
        }
        return error;
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        const processedValue = name === 'amount' ? (value === '' ? 0 : parseFloat(value)) : value;
        setFormData({...formData, [name]: processedValue});
        
        const error = validateField(name, value);
        setErrors(prev => ({...prev, [name]: error}));
    }

    const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setTouched(prev => ({...prev, [name]: true}));
        const error = validateField(name, value);
        setErrors(prev => ({...prev, [name]: error}));
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Validate all
        const e1 = validateField('payerName', formData.payerName);
        const e3 = validateField('amount', formData.amount);
        setTouched({payerName: true, amount: true});
        setErrors({payerName: e1, amount: e3});

        if (e1 || e3) return;

        await addPayment(formData);
        const updatedPayments = await getPayments();
        setRecentPayments(updatedPayments.slice(-5).reverse());
        // Reset form but keep date
        setFormData({
             id: 'RCP-' + new Date().getFullYear() + '-' + Math.floor(Math.random() * 10000),
            payerName: '',
            serviceType: 'vehicle_registration',
            amount: 0,
            paymentMethod: 'cash',
            date: new Date().toISOString().split('T')[0],
            notes: ''
        });
        setTouched({});
        setErrors({});
        addToast("Payment Processed Successfully!", "success");
    }

    const getInputClass = (fieldName: string) => {
        return `w-full p-2 border rounded ${
            touched[fieldName] && errors[fieldName] 
            ? 'border-red-500 bg-red-50' 
            : 'bg-white border-gray-300'
        }`;
    };
  
    const renderError = (fieldName: string) => {
        return touched[fieldName] && errors[fieldName] ? (
            <p className="text-xs text-red-500 mt-1">{errors[fieldName]}</p>
        ) : null;
    };

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-xl p-8 border border-gray-100">
        <div className="flex justify-between items-center mb-6 border-b pb-4 border-gray-200">
            <h1 className="text-2xl font-bold text-gray-800">Payments & Revenue</h1>
            <button
                onClick={onBack}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
            >
                Back to Dashboard
            </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Payment Form */}
            <div className="lg:col-span-2">
                <h2 className="text-xl font-semibold mb-4">Process New Payment</h2>
                <form onSubmit={handleSubmit} className="bg-gray-50 p-6 rounded-lg space-y-4 border border-gray-100">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Receipt Number</label>
                            <input name="id" value={formData.id} readOnly className="w-full p-2 border rounded bg-gray-200 border-gray-300" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Payer Name <span className="text-red-500">*</span></label>
                            <input 
                                name="payerName" 
                                value={formData.payerName} 
                                onChange={handleChange} 
                                onBlur={handleBlur}
                                className={getInputClass('payerName')} 
                                placeholder="Full Name" 
                            />
                            {renderError('payerName')}
                        </div>
                         <div>
                            <label className="block text-sm font-medium mb-1">Service Type</label>
                            <select name="serviceType" value={formData.serviceType} onChange={handleChange} className="w-full p-2 border rounded bg-white border-gray-300">
                                <option value="vehicle_registration">Vehicle Registration</option>
                                <option value="license_fee">Driver License Fee</option>
                                <option value="plate_fee">Plate Issuance Fee</option>
                                <option value="renewal_fee">Renewal Fee</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Payment Method</label>
                            <select name="paymentMethod" value={formData.paymentMethod} onChange={handleChange} className="w-full p-2 border rounded bg-white border-gray-300">
                                <option value="cash">Cash</option>
                                <option value="card">Card</option>
                                <option value="bank_transfer">Bank Transfer</option>
                                <option value="mobile_money">Mobile Money (Telebirr)</option>
                                <option value="cheque">Cheque</option>
                            </select>
                        </div>
                        <div className="md:col-span-2">
                             <label className="block text-sm font-medium mb-1">Amount (ETB) <span className="text-red-500">*</span></label>
                            <input 
                                type="number" 
                                name="amount" 
                                value={formData.amount} 
                                onChange={handleChange} 
                                onBlur={handleBlur}
                                className={getInputClass('amount') + " text-lg font-bold"} 
                                placeholder="0.00" 
                            />
                            {renderError('amount')}
                        </div>
                         <div className="md:col-span-2">
                            <label className="block text-sm font-medium mb-1">Notes</label>
                            <textarea name="notes" value={formData.notes} onChange={handleChange} className="w-full p-2 border rounded bg-white border-gray-300" rows={2}></textarea>
                        </div>
                     </div>
                     <button type="submit" className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition">Process Payment</button>
                </form>
            </div>

            {/* Recent Payments Sidebar */}
            <div>
                 <h2 className="text-xl font-semibold mb-4">Recent Transactions</h2>
                 <div className="space-y-4">
                     {recentPayments.length > 0 ? recentPayments.map(p => (
                         <div key={p.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                             <div className="flex justify-between items-start mb-2">
                                 <div>
                                     <p className="font-bold text-gray-800">{p.payerName}</p>
                                     <p className="text-xs text-gray-500">{p.id}</p>
                                 </div>
                                 <span className="font-bold text-green-600">ETB {p.amount}</span>
                             </div>
                             <p className="text-sm text-gray-700">{p.serviceType.replace('_', ' ')}</p>
                             <p className="text-xs text-gray-500 mt-1 uppercase">{p.paymentMethod}</p>
                         </div>
                     )) : (
                         <p className="text-gray-500 italic">No recent payments recorded.</p>
                     )}
                 </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentProcessingScreen;