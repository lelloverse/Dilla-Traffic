
import React, { useState, useCallback, useEffect } from 'react';
import { UserRole, Application, SearchResult, ProfileData, User, Vehicle, ClerkView, AdminView } from './types';
import { getSearchResults, getUsers, addUser, getVehicles } from './database';
import { supabase } from './supabaseClient';
import { ToastProvider } from './context/ToastContext';
import ToastContainer from './components/shared/ToastContainer';

import LoginComponent from './components/LoginComponent';
import UniversalNav from './components/shared/UniversalNav';

// Clerk components
import ClerkDashboard from './components/clerk/ClerkDashboard';
import VehicleRegistrationFlow from './components/clerk/VehicleRegistrationFlow';
import DriverLicenseFlow from './components/clerk/DriverLicenseFlow';
import PaymentProcessingScreen from './components/clerk/PaymentProcessingScreen';
import ClerkPlateManagementScreen from './components/clerk/ClerkPlateManagementScreen';
import VehicleRegistryScreen from './components/clerk/VehicleRegistryScreen';
import DriverRegistryScreen from './components/clerk/DriverRegistryScreen';
import ViolationManagementScreen from './components/clerk/ViolationManagementScreen';
import ClerkAlertsManagementScreen from './components/clerk/ClerkAlertsManagementScreen';

// Admin components
import AdminDashboard from './components/admin/AdminDashboard';
import UserManagementScreen from './components/admin/UserManagementScreen';
import ReportGeneratorScreen from './components/admin/ReportGeneratorScreen';
import AuditLogScreen from './components/admin/AuditLogScreen';

// Shared components
import VehicleProfileScreen from './components/shared/VehicleProfileScreen';
import DriverProfileScreen from './components/shared/DriverProfileScreen';


const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<UserRole>(UserRole.None);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Universal Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResultsData, setSearchResultsData] = useState<SearchResult[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<ProfileData | null>(null);
  const [searchFilter, setSearchFilter] = useState<'All' | 'Vehicle' | 'Driver'>('All');

  // State for Clerk view
  const [clerkView, setClerkView] = useState<ClerkView>('dashboard');

  // State for Admin view
  const [adminView, setAdminView] = useState<AdminView>('dashboard');

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  
  // Initialize data on first load and set search data
  useEffect(() => {
    const init = async () => {
        const results = await getSearchResults();
        setSearchResultsData(results);
        const allVehicles = await getVehicles();
        setVehicles(allVehicles);
    };
    init();
  }, []);

  const resetAllViews = () => {
    setClerkView('dashboard');
    setAdminView('dashboard');
    setSearchQuery('');
    setSelectedProfile(null);
    setSearchFilter('All');
  };


  const handleLogin = useCallback(async (username: string, password: string): Promise<void> => {
    setIsLoading(true);
    setError('');

    try {
        // Find the user in our profile table first to get their email and status
        // Check username first
        let { data: users, error: userError } = await supabase
            .from('users')
            .select('id, name, username, email, role, woreda_id, status, can_access_web, can_access_mobile')
            .eq('username', username);

        if (userError) {
            console.error('User fetch error:', userError);
        }

        // If not found by username, try searching by email
        if (!users || users.length === 0) {
            const { data: usersByEmail, error: emailError } = await supabase
                .from('users')
                .select('id, name, username, email, role, woreda_id, status, can_access_web, can_access_mobile')
                .eq('email', username);
            
            if (emailError) {
                console.error('Email fetch error:', emailError);
            }
            
            if (usersByEmail && usersByEmail.length > 0) {
                users = usersByEmail;
            }
        }
        
        const userData = users && users.length > 0 ? users[0] : null;

        if (!userData) {
            throw new Error('Invalid username or password.');
        }

        if (!userData.email) {
            throw new Error('User account is missing an email address. Please contact an administrator.');
        }

        if (userData.status !== 'Active') {
            throw new Error('Your account has been deactivated. Please contact an administrator.');
        }

        if (userData.can_access_web === false) {
            throw new Error('This account does not have permission to access the web platform.');
        }

        const { data, error: authError } = await supabase.auth.signInWithPassword({
            email: userData.email,
            password: password,
        });

        if (authError) {
            throw new Error(authError.message === 'Invalid login credentials' ? 'Invalid username or password.' : authError.message);
        }

        if (data.user) {
            setIsLoggedIn(true);
            setUserRole(userData.role as UserRole);
            setCurrentUser({
                id: userData.id,
                name: userData.name,
                username: userData.username,
                email: userData.email,
                role: userData.role as UserRole,
                woredaId: userData.woreda_id,
                status: userData.status as 'Active' | 'Inactive',
                canAccessWeb: userData.can_access_web,
                canAccessMobile: userData.can_access_mobile,
                lastLogin: new Date().toISOString()
            });
        }
    } catch (err: any) {
        setError(err.message || 'Invalid username or password.');
    } finally {
        setIsLoading(false);
    }
  }, []);

  const handleLogout = async (): Promise<void> => {
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    setUserRole(UserRole.None);
    setError('');
    resetAllViews();
  };
  
  // Search Handlers
  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    setSelectedProfile(null); // Clear profile when starting a new search
    const results = await getSearchResults(query);
    setSearchResultsData(results);
  };
  
  const handleSelectSearchResult = (result: SearchResult) => {
    setSelectedProfile(result);
  };
  
  const handleBackToDashboard = () => {
    resetAllViews();
  };

  const renderClerkView = () => {
    const isOfficer = userRole === UserRole.Officer;

    switch (clerkView) {
      case 'new-vehicle':
        if (isOfficer) return <ClerkDashboard onNavigate={setClerkView} userRole={userRole} />;
        return <VehicleRegistrationFlow onBack={() => setClerkView('dashboard')} />;
      case 'new-license':
        if (isOfficer) return <ClerkDashboard onNavigate={setClerkView} userRole={userRole} />;
        return <DriverLicenseFlow onBack={() => setClerkView('dashboard')} />;
      case 'payments':
        if (isOfficer) return <ClerkDashboard onNavigate={setClerkView} userRole={userRole} />;
        return <PaymentProcessingScreen onBack={() => setClerkView('dashboard')} />;
      case 'plates':
        if (isOfficer) return <ClerkDashboard onNavigate={setClerkView} userRole={userRole} />;
        return <ClerkPlateManagementScreen onBack={() => setClerkView('dashboard')} />;
      case 'vehicles':
        return <VehicleRegistryScreen onBack={() => setClerkView('dashboard')} />;
      case 'drivers':
        return <DriverRegistryScreen onBack={() => setClerkView('dashboard')} />;
      case 'violations':
        return <ViolationManagementScreen onBack={() => setClerkView('dashboard')} />;
      case 'alerts':
        return <ClerkAlertsManagementScreen onBack={() => setClerkView('dashboard')} />;
      case 'dashboard':
      default:
        return <ClerkDashboard onNavigate={setClerkView} userRole={userRole} />;
    }
  };

  const renderAdminView = () => {
    switch (adminView) {
      case 'user-management':
        return <UserManagementScreen onBack={() => setAdminView('dashboard')} currentUser={currentUser} />;
      case 'report-generator':
        return <ReportGeneratorScreen onBack={() => setAdminView('dashboard')} currentUser={currentUser} />;
      case 'audit-logs':
        return <AuditLogScreen onBack={() => setAdminView('dashboard')} currentUser={currentUser} />;
      case 'dashboard':
      default:
        return <AdminDashboard onNavigate={setAdminView} currentUser={currentUser} />;
    }
  };

  const renderRoleSpecificContent = () => {
     switch (userRole) {
      case UserRole.Clerk:
      case UserRole.Officer:
        return renderClerkView();
      case UserRole.Admin:
      case UserRole.WoredaAdmin:
        return renderAdminView();
      default:
         handleLogout();
         return null;
    }
  }

  const renderSearchResults = () => {
    const filteredResults = searchQuery ? searchResultsData.filter(r => 
        (searchFilter === 'All' || r.type === searchFilter) &&
        (r.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        r.subtitle.toLowerCase().includes(searchQuery.toLowerCase()))
    ) : [];

    return (
        <div className="p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                    <h2 className="text-xl font-semibold text-gray-800">Search Results for "{searchQuery}"</h2>
                    
                    {/* Filters */}
                    <div className="flex p-1 bg-gray-200 rounded-lg">
                        {(['All', 'Vehicle', 'Driver'] as const).map(filter => (
                            <button
                                key={filter}
                                onClick={() => setSearchFilter(filter)}
                                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                                    searchFilter === filter 
                                    ? 'bg-white text-blue-600 shadow-sm' 
                                    : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                {filter}
                            </button>
                        ))}
                    </div>
                </div>
                
                {filteredResults.length > 0 ? (
                    <div className="bg-white rounded-lg shadow-xl p-4">
                        <ul className="divide-y divide-gray-200">
                           {filteredResults.map(result => {
                               const vehicle = result.type === 'Vehicle' ? vehicles.find(v => v.id === result.id) : null;
                               const isStolen = vehicle?.stolenStatus?.isStolen;
                               
                               return (
                               <li key={result.id} className={`py-3 flex justify-between items-center hover:bg-gray-50 px-2 rounded-lg transition ${isStolen ? 'bg-red-50' : ''}`}>
                                   <div>
                                       <div className="flex items-center gap-2">
                                            <p className={`font-semibold ${isStolen ? 'text-red-700' : 'text-gray-900'}`}>{result.title}</p>
                                            <span className={`px-2 py-0.5 text-xs font-bold rounded-full border ${
                                                isStolen ? 'bg-red-600 text-white border-red-700' :
                                                result.type === 'Vehicle' ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                                                'bg-green-50 text-green-700 border-green-200'
                                            }`}>
                                                {isStolen ? 'STOLEN' : result.type}
                                            </span>
                                       </div>
                                       <p className="text-sm text-gray-500">{result.subtitle}</p>
                                   </div>
                                   <button onClick={() => handleSelectSearchResult(result)} className={`px-4 py-2 text-sm font-medium rounded-lg transition ${isStolen ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                                        View Details
                                   </button>
                               </li>
                           )})}
                        </ul>
                    </div>
                ) : (
                    <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <p className="mt-2 text-gray-500">No results found for "{searchQuery}" in {searchFilter}.</p>
                        {searchFilter !== 'All' && (
                             <button onClick={() => setSearchFilter('All')} className="mt-2 text-blue-600 font-medium hover:underline">
                                View all results
                             </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
  }

  const renderContentArea = () => {
    if (selectedProfile) {
        const onBack = () => setSelectedProfile(null);
        if (selectedProfile.type === 'Vehicle') {
            return <VehicleProfileScreen profileData={selectedProfile} userRole={userRole} onBack={onBack} />;
        }
        if (selectedProfile.type === 'Driver') {
            return <DriverProfileScreen profileData={selectedProfile} userRole={userRole} onBack={onBack} />;
        }
    }

    if (searchQuery) {
        return renderSearchResults();
    }
    
    return renderRoleSpecificContent();
  }
  
  const renderMainContent = () => {
    if (!isLoggedIn) {
      return <LoginComponent onLogin={handleLogin} isLoading={isLoading} error={error} />;
    }

    return (
      <>
        <UniversalNav 
          userRole={userRole} 
          onLogout={handleLogout} 
          onSearch={handleSearch} 
          onHome={handleBackToDashboard}
        />
        <main>
            {renderContentArea()}
        </main>
      </>
    );
  };

  return (
    <div className="bg-white min-h-screen">
        <ToastProvider>
          {renderMainContent()}
          <ToastContainer />
        </ToastProvider>
    </div>
  );
};

export default App;
