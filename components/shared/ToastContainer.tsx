import React from 'react';
import { useToast, ToastType } from '../../context/ToastContext';
import { FaCheckCircle, FaExclamationCircle, FaInfoCircle, FaExclamationTriangle, FaTimes } from 'react-icons/fa';

const Toast: React.FC<{ id: string; message: string; type: ToastType; onClose: () => void }> = ({ id, message, type, onClose }) => {
  const bgColor = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    info: 'bg-blue-600',
    warning: 'bg-yellow-600',
  }[type];

  const icon = {
    success: <FaCheckCircle size={20} />,
    error: <FaExclamationCircle size={20} />,
    info: <FaInfoCircle size={20} />,
    warning: <FaExclamationTriangle size={20} />,
  }[type];

  return (
    <div className={`${bgColor} text-white px-4 py-3 rounded-lg shadow-lg flex items-center space-x-3 mb-3 transition-all transform duration-300 ease-in-out hover:scale-105 min-w-[300px] max-w-md`}>
      <div className="flex-shrink-0">{icon}</div>
      <div className="flex-1 text-sm font-medium">{message}</div>
      <button onClick={onClose} className="flex-shrink-0 hover:opacity-75 focus:outline-none">
        <FaTimes size={16} />
      </button>
    </div>
  );
};

const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end pointer-events-none">
      <div className="pointer-events-auto">
        {toasts.map((toast) => (
          <Toast key={toast.id} {...toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>
    </div>
  );
};

export default ToastContainer;