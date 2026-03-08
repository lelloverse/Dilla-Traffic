import React, { useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { updateVehicle, addAuditLog } from '../../database';
import { Vehicle } from '../../types';
import { useTranslation } from 'react-i18next';

interface VehicleRegistrationFlowProps {
  onBack: () => void;
}

const VehicleRegistrationFlow: React.FC<VehicleRegistrationFlowProps> = ({ onBack }) => {
  const { t } = useTranslation();
  const { addToast } = useToast();

  const steps = [
    t('ownerInformation'),
    t('vehicleSpecifications'),
    t('reviewSubmit')
  ];

  const [currentStep, setCurrentStep] = useState(1);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [formData, setFormData] = useState({
      // Owner
      ownerName: '',
      phone: '',
      address: '',
      nationalId: '',
      // Vehicle
      plateNumber: '',
      type: 'private' as const,
      make: '',
      model: '',
      year: '',
      chassisNumber: '',
      engineNumber: '',
      color: '',
      fuelType: 'petrol'
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validateField = (name: string, value: string): string => {
      let error = '';
      const currentYear = new Date().getFullYear();

      switch(name) {
          case 'ownerName':
              if (!value.trim()) error = t('ownerName') + ' is required';
              break;
          case 'phone':
              if (!value.trim()) error = t('phoneNumber') + ' is required';
              else if (!/^[\d\+\-\s]{10,}$/.test(value)) error = 'Invalid phone format';
              break;
          case 'address':
              if (!value.trim()) error = t('address') + ' is required';
              break;
          case 'nationalId':
              if (!value.trim()) error = t('nationalId') + ' is required';
              break;
          case 'plateNumber':
              if (!value.trim()) error = t('plateRegistration') + ' is required';
              else if (!/^[A-Z0-9\-\s]{3,15}$/i.test(value)) error = 'Invalid plate number format';
              break;
          case 'make':
              if (!value.trim()) error = t('make') + ' is required';
              break;
          case 'model':
              if (!value.trim()) error = t('model') + ' is required';
              break;
          case 'color':
              if (!value.trim()) error = t('color') + ' is required';
              break;
          case 'year':
              if (!value) error = t('year') + ' is required';
              else if (parseInt(value) < 1900 || parseInt(value) > currentYear + 1) error = `Year must be between 1900 and ${currentYear + 1}`;
              break;
          case 'chassisNumber':
              if (!value.trim()) error = t('chassisNumber') + ' is required';
              break;
          case 'engineNumber':
              if (!value.trim()) error = t('engineNumber') + ' is required';
              break;
      }
      return error;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setFormData({...formData, [name]: value});
      
      const error = validateField(name, value);
      setErrors(prev => ({...prev, [name]: error}));
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setTouched(prev => ({...prev, [name]: true}));
      const error = validateField(name, value);
      setErrors(prev => ({...prev, [name]: error}));
  }

  const handleNext = () => {
    // Validate current step fields
    let stepFields: string[] = [];
    if (currentStep === 1) stepFields = ['ownerName', 'phone', 'address', 'nationalId'];
    if (currentStep === 2) stepFields = ['plateNumber', 'make', 'model', 'year', 'color', 'chassisNumber', 'engineNumber'];

    const newErrors: Record<string, string> = {};
    let isValid = true;

    stepFields.forEach(field => {
        setTouched(prev => ({...prev, [field]: true}));
        // @ts-ignore
        const error = validateField(field, formData[field]);
        if (error) {
            newErrors[field] = error;
            isValid = false;
        }
    });

    setErrors(prev => ({...prev, ...newErrors}));

    if (isValid && currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmitClick = () => {
      setShowConfirmation(true);
  };

  const confirmSubmit = () => {
      setShowConfirmation(false);
      
      const newVehicle: any = {
          id: 'VEH-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
          plateNumber: formData.plateNumber,
          make: formData.make,
          model: formData.model,
          year: parseInt(formData.year),
          ownerName: formData.ownerName,
          ownerPhone: formData.phone,
          type: formData.type,
          status: 'Active',
          expiryDate: new Date(new Date().setFullYear(new Date().getFullYear() + 2)).toISOString().split('T')[0], // 2 years expiry
          // Map additional fields for database.ts
          address: formData.address,
          nationalId: formData.nationalId,
          chassisNumber: formData.chassisNumber,
          engineNumber: formData.engineNumber,
          color: formData.color,
          fuelType: formData.fuelType
      };

      updateVehicle(newVehicle);
      
      addAuditLog({
          user: 'clerk',
          role: 'Clerk',
          action: 'Vehicle Registered',
          details: `Registered vehicle ${newVehicle.make} ${newVehicle.model} with plate ${newVehicle.plateNumber}`,
          ipAddress: '127.0.0.1',
          status: 'success'
      });

      addToast(t('registrationSuccess'), "success");
      onBack();
  };

  const getInputClass = (fieldName: string) => {
      return `w-full p-2 border rounded ${
          touched[fieldName] && errors[fieldName] 
          ? 'border-red-500 bg-red-50' 
          : 'bg-gray-50 border-gray-300'
      }`;
  };

  const renderError = (fieldName: string) => {
      return touched[fieldName] && errors[fieldName] ? (
          <p className="text-xs text-red-500 mt-1">{errors[fieldName]}</p>
      ) : null;
  };
  
  const renderStepContent = () => {
      switch(currentStep) {
          case 1: return (
              <div className="space-y-4">
                  <h3 className="text-lg font-medium mb-4 border-b pb-2">{t('ownerInformation')}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                          <label className="block text-sm font-medium mb-1">{t('ownerName')} <span className="text-red-500">*</span></label>
                          <input 
                            name="ownerName" 
                            value={formData.ownerName} 
                            onChange={handleChange} 
                            onBlur={handleBlur}
                            className={getInputClass('ownerName')} 
                            placeholder="e.g. Abebe Kebede" 
                          />
                          {renderError('ownerName')}
                      </div>
                      <div>
                          <label className="block text-sm font-medium mb-1">{t('phoneNumber')} <span className="text-red-500">*</span></label>
                          <input 
                            name="phone" 
                            value={formData.phone} 
                            onChange={handleChange} 
                            onBlur={handleBlur}
                            className={getInputClass('phone')} 
                            placeholder="+251..." 
                          />
                          {renderError('phone')}
                      </div>
                      <div>
                          <label className="block text-sm font-medium mb-1">{t('address')} <span className="text-red-500">*</span></label>
                          <input 
                            name="address" 
                            value={formData.address} 
                            onChange={handleChange} 
                            onBlur={handleBlur}
                            className={getInputClass('address')} 
                            placeholder="City, Sub-city" 
                          />
                          {renderError('address')}
                      </div>
                      <div>
                          <label className="block text-sm font-medium mb-1">{t('nationalId')} <span className="text-red-500">*</span></label>
                          <input 
                            name="nationalId" 
                            value={formData.nationalId} 
                            onChange={handleChange} 
                            onBlur={handleBlur}
                            className={getInputClass('nationalId')} 
                            placeholder="National ID number" 
                          />
                          {renderError('nationalId')}
                      </div>
                  </div>
              </div>
          );
          case 2: return (
              <div className="space-y-4">
                  <h3 className="text-lg font-medium mb-4 border-b pb-2">{t('vehicleSpecifications')}</h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                          <label className="block text-sm font-medium mb-1">{t('plateRegistration')} <span className="text-red-500">*</span></label>
                          <input 
                            name="plateNumber" 
                            value={formData.plateNumber} 
                            onChange={handleChange} 
                            onBlur={handleBlur}
                            className={getInputClass('plateNumber')} 
                            placeholder="e.g. AA-2-A12345" 
                          />
                          {renderError('plateNumber')}
                      </div>
                      <div>
                          <label className="block text-sm font-medium mb-1">{t('vehicleType')}</label>
                          <select name="type" value={formData.type} onChange={handleChange} className="w-full p-2 border rounded bg-gray-50 border-gray-300">
                              <option value="private">{t('private')}</option>
                              <option value="commercial">{t('commercial')}</option>
                              <option value="motorcycle">{t('motorcycle')}</option>
                              <option value="truck">{t('truck')}</option>
                              <option value="bus">{t('bus')}</option>
                          </select>
                      </div>
                      <div>
                          <label className="block text-sm font-medium mb-1">{t('make')} <span className="text-red-500">*</span></label>
                          <input 
                            name="make" 
                            value={formData.make} 
                            onChange={handleChange} 
                            onBlur={handleBlur}
                            className={getInputClass('make')} 
                            placeholder="e.g. Toyota" 
                          />
                          {renderError('make')}
                      </div>
                      <div>
                          <label className="block text-sm font-medium mb-1">{t('model')} <span className="text-red-500">*</span></label>
                          <input 
                            name="model" 
                            value={formData.model} 
                            onChange={handleChange} 
                            onBlur={handleBlur}
                            className={getInputClass('model')} 
                            placeholder="e.g. Corolla" 
                          />
                          {renderError('model')}
                      </div>
                       <div>
                          <label className="block text-sm font-medium mb-1">{t('year')} <span className="text-red-500">*</span></label>
                          <input 
                            name="year" 
                            type="number" 
                            value={formData.year} 
                            onChange={handleChange} 
                            onBlur={handleBlur}
                            className={getInputClass('year')} 
                            placeholder="2023" 
                          />
                          {renderError('year')}
                      </div>
                       <div>
                          <label className="block text-sm font-medium mb-1">{t('chassisNumber')} <span className="text-red-500">*</span></label>
                          <input 
                            name="chassisNumber" 
                            value={formData.chassisNumber} 
                            onChange={handleChange} 
                            onBlur={handleBlur}
                            className={getInputClass('chassisNumber')} 
                          />
                          {renderError('chassisNumber')}
                      </div>
                       <div>
                          <label className="block text-sm font-medium mb-1">{t('engineNumber')} <span className="text-red-500">*</span></label>
                          <input 
                            name="engineNumber" 
                            value={formData.engineNumber} 
                            onChange={handleChange} 
                            onBlur={handleBlur}
                            className={getInputClass('engineNumber')} 
                          />
                          {renderError('engineNumber')}
                      </div>
                      <div>
                          <label className="block text-sm font-medium mb-1">{t('color')} <span className="text-red-500">*</span></label>
                          <input 
                            name="color" 
                            value={formData.color} 
                            onChange={handleChange} 
                            onBlur={handleBlur}
                            className={getInputClass('color')} 
                            placeholder="e.g. Silver" 
                          />
                          {renderError('color')}
                      </div>
                       <div>
                          <label className="block text-sm font-medium mb-1">{t('fuelType')}</label>
                          <select name="fuelType" value={formData.fuelType} onChange={handleChange} className="w-full p-2 border rounded bg-gray-50 border-gray-300">
                              <option value="petrol">{t('petrol')}</option>
                              <option value="diesel">{t('diesel')}</option>
                              <option value="electric">{t('electric')}</option>
                              <option value="hybrid">{t('hybrid')}</option>
                          </select>
                      </div>
                  </div>
              </div>
          );
          case 3: return (
              <div className="space-y-6">
                 <div className="text-center">
                     <h3 className="text-2xl font-bold text-gray-800 mb-2">{t('reviewDetails')}</h3>
                     <p className="text-gray-500">{t('confirmInformation')}</p>
                 </div>
                 <div className="bg-gray-50 p-4 rounded-lg">
                     <h4 className="font-bold border-b pb-1 mb-2">{t('ownerInformation')}</h4>
                     <p>{formData.ownerName} ({formData.phone})</p>
                     <p className="text-sm text-gray-700">{t('nationalId')}: {formData.nationalId}</p>
                     <p className="text-sm text-gray-500">{formData.address}</p>
                 </div>
                 <div className="bg-gray-50 p-4 rounded-lg">
                     <h4 className="font-bold border-b pb-1 mb-2">{t('vehicleSpecifications')}</h4>
                     <p>{formData.year} {formData.make} {formData.model} ({t(formData.type)})</p>
                     <p>{t('plateRegistration')}: <span className="font-semibold">{formData.plateNumber}</span> | {t('color')}: <span className="font-semibold">{formData.color}</span></p>
                     <p className="text-sm text-gray-500">{t('chassisNumber')}: {formData.chassisNumber} | {t('engineNumber')}: {formData.engineNumber}</p>
                 </div>
              </div>
           );
          default: return null;
      }
  }

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-xl p-8 border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">{t('newVehicleRegistration')}</h1>
        <p className="text-gray-500 mb-6">{t('stepOutOf', { current: currentStep, total: steps.length, step: steps[currentStep-1] })}</p>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-8">
          <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${(currentStep / steps.length) * 100}%` }}></div>
        </div>

        <div className="min-h-[300px] mb-8">
            {renderStepContent()}
        </div>

        <div className="flex justify-between items-center mt-8 pt-4 border-t border-gray-200">
          <button
            onClick={onBack}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
          >
            {t('cancel')}
          </button>
          <div className="flex gap-4">
            {currentStep > 1 && (
              <button
                onClick={handlePrev}
                className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
              >
                {t('previous')}
              </button>
            )}
             {currentStep < steps.length ? (
              <button
                onClick={handleNext}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                {t('next')}
              </button>
            ) : (
                <button
                onClick={handleSubmitClick}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                {t('submitRegistration')}
                </button>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmation && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 animate-fade-in">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">{t('confirmSubmission')}</h3>
                  <p className="text-gray-600 mb-6">
                      {t('confirmVehicleRegText')}
                  </p>
                  
                  <div className="bg-gray-50 p-4 rounded-lg mb-6 text-sm space-y-2">
                      <p><span className="font-semibold">{t('ownerName')}:</span> {formData.ownerName} ({formData.nationalId})</p>
                      <p><span className="font-semibold">{t('plateRegistration')}:</span> {formData.plateNumber} | <span className="font-semibold">{t('color')}:</span> {formData.color}</p>
                      <p><span className="font-semibold">{t('vehicleSpecifications')}:</span> {formData.year} {formData.make} {formData.model}</p>
                      <p><span className="font-semibold">{t('chassisNumber')}:</span> {formData.chassisNumber}</p>
                      <p><span className="font-semibold">{t('engineNumber')}:</span> {formData.engineNumber}</p>
                  </div>

                  <div className="flex justify-end gap-3">
                      <button 
                        onClick={() => setShowConfirmation(false)}
                        className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
                      >
                          {t('editDetails')}
                      </button>
                      <button 
                        onClick={confirmSubmit}
                        className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition"
                      >
                          {t('confirmAndSubmit')}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default VehicleRegistrationFlow;