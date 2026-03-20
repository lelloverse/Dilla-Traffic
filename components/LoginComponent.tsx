import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface LoginComponentProps {
  onLogin: (username: string, password: string) => void;
  isLoading: boolean;
  error: string;
}

const LoginComponent: React.FC<LoginComponentProps> = ({ onLogin, isLoading, error }) => {
  const { t, i18n } = useTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onLogin(username, password);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white p-4">
      <div className="absolute top-4 right-4 flex bg-white rounded-lg p-1 shadow">
          <button 
              onClick={() => i18n.changeLanguage('en')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${i18n.language === 'en' ? 'bg-blue-100 text-blue-600' : 'text-gray-500'}`}
          >
              English
          </button>
          <button 
                onClick={() => i18n.changeLanguage('am')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${i18n.language === 'am' ? 'bg-blue-100 text-blue-600' : 'text-gray-500'}`}
          >
              አማርኛ
          </button>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md border border-gray-100">
        <div className="flex flex-col items-center mb-6">
          <img 
            src="https://upload.wikimedia.org/wikipedia/commons/9/91/Ministry_of_Transport_and_Communications_of_Ethiopia.png" 
            alt="Ministry of Transport and Logistics Logo" 
            className="h-32 w-auto mb-6 rounded-full" 
          />
          <h1 className="text-3xl font-bold text-gray-800 text-center">
              {t('loginTitle')}
          </h1>
          <p className="text-gray-500 mt-2">
              {t('loginSubtitle')}
          </p>
        </div>
        
{error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-4 p-4" role="alert">
            <div className="flex items-start">
              <svg className="h-5 w-5 text-red-400 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="text-sm">{error}</span>
            </div>
            <button onClick={() => {/* Clear error when clicked */}} className="absolute top-2 right-2 text-red-400 hover:text-red-600">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700">
              {t('username')}
            </label>
            <div className="mt-1">
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
                placeholder="Username"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              {t('password')}
            </label>
            <div className="mt-1">
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
                placeholder="Password"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 disabled:cursor-not-allowed transition duration-300"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t('signingIn')}
                </>
              ) : (
                t('signIn')
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginComponent;