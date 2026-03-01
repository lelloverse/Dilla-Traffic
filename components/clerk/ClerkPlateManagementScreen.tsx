import React, { useState, useEffect } from 'react';
import { addPlate, getPlates } from '../../database';
import { PlateItem } from '../../types';
import { useToast } from '../../context/ToastContext';

interface ClerkPlateManagementScreenProps {
  onBack: () => void;
}

const ClerkPlateManagementScreen: React.FC<ClerkPlateManagementScreenProps> = ({ onBack }) => {
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

    useEffect(() => {
        const fetchPlates = async () => {
            const data = await getPlates();
            setPlates(data);
        };
        fetchPlates();
    }, []);

    const validateField = (name: string, value: string): string => {
        let error = '';
        if (name === 'plateNumber') {
            if (!value.trim()) error = 'Plate Number is required';
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

        await addPlate(formData);
        const updatedPlates = await getPlates();
        setPlates(updatedPlates);
        setFormData({
            plateNumber: '',
            type: 'private',
            dateReceived: new Date().toISOString().split('T')[0],
            status: 'available',
            notes: ''
        });
        setTouched({});
        addToast("Plate added to inventory successfully", "success");
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
            <h1 className="text-2xl font-bold text-gray-800">Plate Stock Management</h1>
            <button
                onClick={onBack}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
            >
                Back to Dashboard
            </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Add New Plate Form */}
            <div>
                 <h2 className="text-xl font-semibold mb-4">Add New Inventory</h2>
                 <form onSubmit={handleSubmit} className="bg-gray-50 p-6 rounded-lg space-y-4 border border-gray-100">
                     <div>
                         <label className="block text-sm font-medium mb-1">Plate Number <span className="text-red-500">*</span></label>
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
                         <label className="block text-sm font-medium mb-1">Plate Type</label>
                         <select name="type" value={formData.type} onChange={handleChange} className="w-full p-2 border rounded bg-white border-gray-300">
                             <option value="private">Private</option>
                             <option value="commercial">Commercial</option>
                             <option value="government">Government</option>
                             <option value="diplomatic">Diplomatic</option>
                         </select>
                     </div>
                      <div>
                         <label className="block text-sm font-medium mb-1">Date Received</label>
                         <input type="date" name="dateReceived" value={formData.dateReceived} onChange={handleChange} className="w-full p-2 border rounded bg-white border-gray-300" />
                     </div>
                     <div>
                         <label className="block text-sm font-medium mb-1">Initial Status</label>
                         <select name="status" value={formData.status} onChange={handleChange} className="w-full p-2 border rounded bg-white border-gray-300">
                             <option value="available">Available</option>
                             <option value="assigned">Assigned</option>
                             <option value="lost">Lost</option>
                             <option value="defaced">Defaced</option>
                         </select>
                     </div>
                     <div>
                         <label className="block text-sm font-medium mb-1">Notes</label>
                         <textarea name="notes" value={formData.notes} onChange={handleChange} className="w-full p-2 border rounded bg-white border-gray-300" placeholder="e.g. Batch from Manufacturer X"></textarea>
                     </div>
                     <button type="submit" className="w-full py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition">Add to Stock</button>
                 </form>
            </div>

            {/* Inventory List */}
            <div>
                <h2 className="text-xl font-semibold mb-4">Current Stock</h2>
                <div className="bg-white border rounded-lg overflow-hidden max-h-[500px] overflow-y-auto shadow-sm">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-100 sticky top-0">
                            <tr>
                                <th className="px-4 py-3">Plate #</th>
                                <th className="px-4 py-3">Type</th>
                                <th className="px-4 py-3">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {plates.length > 0 ? plates.map((plate, idx) => (
                                <tr key={idx} className="border-b hover:bg-gray-50">
                                    <td className="px-4 py-3 font-medium text-gray-900">{plate.plateNumber}</td>
                                    <td className="px-4 py-3 capitalize text-gray-700">{plate.type}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded text-xs font-semibold 
                                            ${plate.status === 'available' ? 'bg-green-100 text-green-800' : 
                                              plate.status === 'assigned' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>
                                            {plate.status}
                                        </span>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={3} className="px-4 py-4 text-center text-gray-500">No plates in inventory.</td>
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