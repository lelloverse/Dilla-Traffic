import React, { useState, useEffect } from 'react';
import { addPlate, getPlates } from '../../database';
import { PlateItem } from '../../types';
import { useToast } from '../../context/ToastContext';
import { useTranslation } from 'react-i18next';

interface ClerkPlateManagementScreenProps {
  onBack: () => void;
}

const ClerkPlateManagementScreen: React.FC<ClerkPlateManagementScreenProps> = ({ onBack }) => {
    const { t } = useTranslation();
    const { addToast } = useToast();
    const [plates, setPlates] = useState<PlateItem[]>([]);
    const [formData, setFormData] = useState<PlateItem>({
        plateNumber: '',
        type: 'private',
        dateReceived: new Date().toISOString().split('T')[0],
        status: 'available',
        notes: ''
    });

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [touched, setTouched] = useState<Record<string, boolean>>({});
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const fetchPlates = async () => {
            try {
                setIsLoading(true);
                const data = await getPlates();
                setPlates(data.slice().reverse());
            } catch (err) {
                console.error('Failed to fetch plates:', err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchPlates();
    }, []);

    const validateField = (name: string, value: string): string => {
        let error = '';
        if (name === 'plateNumber') {
            if (!value.trim()) error = t('plateNumber') + ' is required';
            // You could add specific plate format regex here if needed
        }
        return error;
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData({...formData, [name]: value});
        
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
        
        const error = validateField('plateNumber', formData.plateNumber);
        if (error) {
            setTouched(prev => ({...prev, plateNumber: true}));
            setErrors(prev => ({...prev, plateNumber: error}));
            return;
        }

        try {
            setIsLoading(true);
            await addPlate(formData);
            const updatedPlates = await getPlates();
            setPlates(updatedPlates.slice().reverse());
            setFormData({
                plateNumber: '',
                type: 'private',
                dateReceived: new Date().toISOString().split('T')[0],
                status: 'available',
                notes: ''
            });
            setTouched({});
            addToast("Plate added to inventory successfully", "success");
        } catch (err: any) {
            console.error('❌ Failed to add plate:', err);
            addToast(err.message || "Failed to add plate to inventory", "error");
        } finally {
            setIsLoading(false);
        }
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
            <h1 className="text-2xl font-bold text-gray-800">{t('plateStockManagement')}</h1>
            <button
                onClick={onBack}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
            >
                {t('backToDashboard')}
            </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Add New Plate Form */}
            <div>
                 <h2 className="text-xl font-semibold mb-4">{t('addNewInventory')}</h2>
                 <form onSubmit={handleSubmit} className="bg-gray-50 p-6 rounded-lg space-y-4 border border-gray-100">
                     <div>
                         <label className="block text-sm font-medium mb-1">{t('plateNumber')} <span className="text-red-500">*</span></label>
                         <input 
                            name="plateNumber" 
                            value={formData.plateNumber} 
                            onChange={handleChange} 
                            onBlur={handleBlur}
                            className={getInputClass('plateNumber')} 
                            placeholder="e.g. AA-12345" 
                        />
                         {renderError('plateNumber')}
                     </div>
                     <div>
                         <label className="block text-sm font-medium mb-1">{t('plateType')}</label>
                         <select name="type" value={formData.type} onChange={handleChange} className="w-full p-2 border rounded bg-white border-gray-300">
                             <option value="private">{t('private')}</option>
                             <option value="commercial">{t('commercial')}</option>
                             <option value="government">{t('government')}</option>
                             <option value="diplomatic">{t('diplomatic')}</option>
                         </select>
                     </div>
                      <div>
                         <label className="block text-sm font-medium mb-1">{t('dateReceived')}</label>
                         <input type="date" name="dateReceived" value={formData.dateReceived} onChange={handleChange} className="w-full p-2 border rounded bg-white border-gray-300" />
                     </div>
                     <div>
                         <label className="block text-sm font-medium mb-1">{t('initialStatus')}</label>
                         <select name="status" value={formData.status} onChange={handleChange} className="w-full p-2 border rounded bg-white border-gray-300">
                             <option value="available">{t('available')}</option>
                             <option value="assigned">{t('assigned')}</option>
                             <option value="lost">{t('lost')}</option>
                             <option value="defaced">{t('defaced')}</option>
                         </select>
                     </div>
                     <div>
                         <label className="block text-sm font-medium mb-1">{t('notes')}</label>
                         <textarea name="notes" value={formData.notes} onChange={handleChange} className="w-full p-2 border rounded bg-white border-gray-300" placeholder="e.g. Batch from Manufacturer X"></textarea>
                     </div>
                     <button type="submit" className="w-full py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition">{t('addToStock')}</button>
                 </form>
            </div>

            {/* Inventory List */}
            <div>
                <h2 className="text-xl font-semibold mb-4">{t('currentStock')}</h2>
                <div className="bg-white border rounded-lg overflow-hidden max-h-[445px] overflow-y-auto shadow-sm relative">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-100 sticky top-0 z-10 border-b">
                            <tr>
                                <th className="px-4 py-3 bg-gray-100">{t('plateNumber')}</th>
                                <th className="px-4 py-3 bg-gray-100">{t('plateType')}</th>
                                <th className="px-4 py-3 bg-gray-100">{t('initialStatus')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {plates.length > 0 ? plates.map((plate, idx) => (
                                <tr key={idx} className="border-b hover:bg-gray-50">
                                    <td className="px-4 py-3 font-medium text-gray-900">{plate.plateNumber}</td>
                                    <td className="px-4 py-3 capitalize text-gray-700">{t(plate.type)}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded text-xs font-semibold 
                                            ${plate.status === 'available' ? 'bg-green-100 text-green-800' : 
                                              plate.status === 'assigned' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>
                                            {t(plate.status)}
                                        </span>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={3} className="px-4 py-4 text-center text-gray-500">{t('noPlatesInventory')}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ClerkPlateManagementScreen;