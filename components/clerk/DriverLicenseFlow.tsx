import React, { useState } from 'react';
import { updateApplication, updateDriver, addAuditLog } from '../../database';
import { Application, ApplicationType, ApplicationStatus, Driver } from '../../types';
import { useToast } from '../../context/ToastContext';
import { useTranslation } from 'react-i18next';

interface DriverLicenseFlowProps {
  onBack: () => void;
}

const DriverLicenseFlow: React.FC<DriverLicenseFlowProps> = ({ onBack }) => {
  const { t } = useTranslation();
  const { addToast } = useToast();

  const steps = [
    t('applicantIdentity'),
    t('contactAddress'),
    t('reviewSubmit')
  ];

  const [currentStep, setCurrentStep] = useState(1);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [formData, setFormData] = useState({
      appId: 'DL-' + new Date().getFullYear() + '-' + Math.floor(Math.random() * 1000),
      firstName: '',
      lastName: '',
      dob: '',
      gender: 'Male' as const,
      phone: '',
      address: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validateField = (name: string, value: string): string => {
      let error = '';
      switch(name) {
          case 'firstName':
              if (!value.trim()) error = t('firstName') + ' is required';
              else if (value.length < 2) error = 'Name too short';
              break;
          case 'lastName':
              if (!value.trim()) error = t('lastName') + ' is required';
              break;
          case 'dob':
              if (!value) error = t('dob') + ' is required';
              else {
                  const birthDate = new Date(value);
                  const today = new Date();
                  let age = today.getFullYear() - birthDate.getFullYear();
                  const m = today.getMonth() - birthDate.getMonth();
                  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                      age--;
                  }
                  if (age < 18) error = 'Applicant must be at least 18 years old';
              }
              break;
          case 'phone':
              if (!value.trim()) error = t('phoneNumber') + ' is required';
              else if (!/^[\d\+\-\s]{10,}$/.test(value)) error = 'Invalid phone format (e.g. +251...)';
              break;
          case 'address':
              if (!value.trim()) error = t('address') + ' is required';
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

  const isStepValid = () => {
      if (currentStep === 1) {
          return !errors.firstName && !errors.lastName && !errors.dob && 
                 formData.firstName && formData.lastName && formData.dob;
      }
      if (currentStep === 2) {
          return !errors.phone && !errors.address && 
                 formData.phone && formData.address;
      }
      return true;
  }

  const handleNext = () => {
    // Mark all current step fields as touched to show errors if they are empty
    if (currentStep === 1) {
        setTouched(prev => ({...prev, firstName: true, lastName: true, dob: true}));
        const e1 = validateField('firstName', formData.firstName);
        const e2 = validateField('lastName', formData.lastName);
        const e3 = validateField('dob', formData.dob);
        setErrors(prev => ({...prev, firstName: e1, lastName: e2, dob: e3}));
        if (e1 || e2 || e3) return;
    }
    if (currentStep === 2) {
        setTouched(prev => ({...prev, phone: true, address: true}));
        const e1 = validateField('phone', formData.phone);
        const e3 = validateField('address', formData.address);
        setErrors(prev => ({...prev, phone: e1, address: e3}));
        if (e1 || e3) return;
    }

    if (currentStep < steps.length) {
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
      const newApp: Application = {
          id: formData.appId,
          applicantName: `${formData.firstName} ${formData.lastName}`,
          firstName: formData.firstName,
          lastName: formData.lastName,
          gender: formData.gender,
          phone: formData.phone,
          type: ApplicationType.NewLicense,
          submittedDate: new Date().toISOString().split('T')[0],
          status: ApplicationStatus.Pending,
          details: {
              dob: formData.dob,
              address: formData.address,
              documents: [],
              testResults: [],
              notes: []
          }
      };
      updateApplication(newApp);

      // For stock number update requested by user, we also add the driver to the registry
      const newDriver: Driver = {
          id: 'DRV-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
          licenseNumber: 'L-' + Math.floor(100000 + Math.random() * 900000),
          fullName: `${formData.firstName} ${formData.lastName}`,
          phone: formData.phone,
          email: `${formData.firstName.toLowerCase()}@example.com`,
          gender: formData.gender,
          status: 'Active',
          expiryDate: new Date(new Date().setFullYear(new Date().getFullYear() + 5)).toISOString().split('T')[0], // 5 years
          associatedVehicles: []
      };
      updateDriver(newDriver);

      addAuditLog({
          user: 'clerk',
          role: 'Clerk',
          action: 'Driver Licensed',
          details: `Processed new license application and registry for ${newDriver.fullName}`,
          ipAddress: '127.0.0.1',
          status: 'success'
      });

      addToast(t('applicationSuccess'), "success");
      onBack();
  }

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
                  <h3 className="text-lg font-medium mb-4 border-b pb-2">{t('applicantIdentity')}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                          <label className="block text-sm font-medium mb-1">{t('applicationId')}</label>
                          <input value={formData.appId} readOnly className="w-full p-2 border rounded bg-gray-200 cursor-not-allowed" />
                      </div>
                      <div>
                          <label className="block text-sm font-medium mb-1">{t('gender')}</label>
                          <select name="gender" value={formData.gender} onChange={handleChange} className="w-full p-2 border rounded bg-gray-50 border-gray-300">
                              <option value="Male">{t('male')}</option>
                              <option value="Female">{t('female')}</option>
                          </select>
                      </div>
                      <div>
                          <label className="block text-sm font-medium mb-1">{t('firstName')} <span className="text-red-500">*</span></label>
                          <input 
                            name="firstName" 
                            value={formData.firstName} 
                            onChange={handleChange} 
                            onBlur={handleBlur}
                            className={getInputClass('firstName')} 
                            placeholder="e.g. Abebe" 
                          />
                          {renderError('firstName')}
                      </div>
                      <div>
                          <label className="block text-sm font-medium mb-1">{t('lastName')} <span className="text-red-500">*</span></label>
                          <input 
                            name="lastName" 
                            value={formData.lastName} 
                            onChange={handleChange} 
                            onBlur={handleBlur}
                            className={getInputClass('lastName')} 
                            placeholder="e.g. Kebede" 
                          />
                          {renderError('lastName')}
                      </div>
                      <div>
                          <label className="block text-sm font-medium mb-1">{t('dob')} <span className="text-red-500">*</span></label>
                          <input 
                            type="date" 
                            name="dob" 
                            value={formData.dob} 
                            onChange={handleChange} 
                            onBlur={handleBlur}
                            className={getInputClass('dob')} 
                          />
                          {renderError('dob')}
                      </div>
                  </div>
              </div>
          );
          case 2: return (
              <div className="space-y-4">
                  <h3 className="text-lg font-medium mb-4 border-b pb-2">{t('contactAddress')}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                          <label className="block text-sm font-medium mb-1">{t('residentialAddress')} <span className="text-red-500">*</span></label>
                          <input 
                            name="address" 
                            value={formData.address} 
                            onChange={handleChange} 
                            onBlur={handleBlur}
                            className={getInputClass('address')} 
                            placeholder="Full address" 
                          />
                          {renderError('address')}
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
                  </div>
              </div>
          );
          case 3: return (
            <div className="space-y-6">
                <div className="text-center">
                    <h3 className="text-2xl font-bold text-gray-800 mb-2">{t('confirmApplication')}</h3>
                    <p className="text-gray-500">{t('officerReviewText')}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg flex flex-col items-center">
                    <p className="text-lg font-bold">{formData.firstName} {formData.lastName}</p>
                    <p>{t('dob')}: {formData.dob}</p>
                    <p>{t('phoneNumber')}: {formData.phone}</p>
                    <p className="text-sm text-gray-500 mt-2">{t('applicationId')}: {formData.appId}</p>
                </div>
            </div>
          );
          default: return null;
      }
  }

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-xl p-8 border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">{t('newDriverLicenseApp')}</h1>
        <p className="text-gray-500 mb-6">{t('stepOutOf', { current: currentStep, total: steps.length, step: steps[currentStep-1] })}</p>
        
        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-8">
          <div className="bg-green-600 h-2.5 rounded-full" style={{ width: `${(currentStep / steps.length) * 100}%` }}></div>
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
                className={`px-6 py-2 bg-green-600 text-white rounded-lg transition ${!isStepValid() ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-700'}`}
              >
                {t('next')}
              </button>
            ) : (
                <button
                onClick={handleSubmitClick}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                {t('submitApplication')}
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
                      Are you sure you want to submit this application? Please verify the details below one last time.
                  </p>
                  
                  <div className="bg-gray-50 p-4 rounded-lg mb-6 text-sm space-y-2">
                      <p><span className="font-semibold">{t('firstName')}:</span> {formData.firstName} {formData.lastName}</p>
                      <p><span className="font-semibold">{t('dob')}:</span> {formData.dob}</p>
                      <p><span className="font-semibold">{t('phoneNumber')}:</span> {formData.phone}</p>
                      <p><span className="font-semibold">{t('address')}:</span> {formData.address}</p>
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

export default DriverLicenseFlow;