
import React, { useState, useCallback, useEffect, useRef } from 'react';

const ABORT_DELAY = 30000; // Increased to 30 seconds for slower networks

import { UserRole, Application, SearchResult, ProfileData, User, Vehicle, ClerkView, AdminView } from './types';
import { getSearchResults, getUsers, addUser, getVehicles, getUserProfile, validateSession, ApiResponse } from './database';
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


const robustCleanup = async () => {
  try {
    // ⏳ Add a 2s timeout to signOut to prevent hanging if network is unstable
    await Promise.race([
      supabase.auth.signOut(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Sign out timeout')), 2000))
    ]).catch(err => console.warn('Sign out timed out or failed, proceeding with local cleanup:', err));
  } catch (err) {
    console.warn('Sign out error:', err);
  }
  
  // Clear Supabase tokens from BOTH storage types
  const url = import.meta.env.VITE_SUPABASE_URL;
  if (url) {
    const ref = url.match(/https:\/\/([^\.]+)\.supabase\.co/)?.[1];
    if (ref) {
      const key = `sb-${ref}-auth-token`;
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    }
  }
  
  // Clear all session storage
  sessionStorage.clear();
};

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
  
  const authSubscription = useRef<(() => void) | null>(null);
  
  // Auth state monitoring - sync with Supabase (FIXED CLEANUP)
  useEffect(() => {
    // 🛡️ INITIAL CLEANUP: Purge any stale localStorage tokens if using sessionStorage
    const purgeStaleStorage = () => {
      const url = import.meta.env.VITE_SUPABASE_URL;
      if (url) {
        const ref = url.match(/https:\/\/([^\.]+)\.supabase\.co/)?.[1];
        if (ref) {
          const key = `sb-${ref}-auth-token`;
          // Only remove from localStorage if we are committed to sessionStorage
          if (localStorage.getItem(key)) {
            console.log('🧹 Purging stale localStorage Supabase token');
            localStorage.removeItem(key);
          }
        }
      }
    };
    purgeStaleStorage();

    // Cleanup previous subscription
    if (authSubscription.current) {
      authSubscription.current();
      authSubscription.current = null;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, !!session);
      
      if (event === 'SIGNED_OUT' || !session) {
        setIsLoggedIn(false);
        setUserRole(UserRole.None);
        setCurrentUser(null);
        setError('');
        resetAllViews();
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (!session.user) return;

        // Validate session token
        const isValid = await validateSession();
        if (!isValid) {
          await robustCleanup();
          setError('Session invalid. Logged out.');
          return;
        }

        // Fetch extended user profile from public.users
        try {
          const { data: userData, error } = await supabase
            .from('users')
            .select('id, name, username, email, role, woreda_id, status, can_access_web, can_access_mobile')
            .eq('id', session.user.id)
            .single();

          if (error || !userData || userData.status !== 'Active' || userData.can_access_web === false) {
            console.warn('User profile invalid, signing out:', error || 'Invalid status or permissions');
            await robustCleanup();
            return;
          }

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
        } catch (err) {
          console.error('Failed to load user profile:', err);
          await robustCleanup();
        }
      }
    });

    authSubscription.current = () => {
      if (subscription) subscription.unsubscribe();
    };

    // Cleanup on unmount
    return () => {
      if (authSubscription.current) {
        authSubscription.current();
        authSubscription.current = null;
      }
    };
  }, []);

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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ABORT_DELAY);

    console.log('🔐 Login attempt:', { username });

    try {
        // 🛡️ FIRST: SILENT storage purge (no state updates to prevent UI conflicts)
        console.log('🔑 Silent purge of existing session tokens');
        await robustCleanup();

        // 🚀 NEXT: Single optimized query using database.getUserProfile()
        console.log('🔍 [LOGIN] Single query for username/email:', username);
        const queryStart = performance.now();
        
        let userData;
        try {
          userData = await Promise.race([
            getUserProfile(username),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error(`Profile query timeout (${ABORT_DELAY/1000}s)`)), ABORT_DELAY)
            )
          ]);
          const queryTime = performance.now() - queryStart;
          console.log(`✅ [LOGIN] Profile query OK (${queryTime.toFixed(0)}ms):`, {
            found: !!userData,
            username: userData?.username,
            email: userData?.email,
            status: userData?.status
          });
        } catch (profileError: any) {
          console.error('❌ [LOGIN] Profile query FAILED:', profileError);
          throw new Error(`Profile lookup failed: ${profileError.message}`);
        }

        if (!userData) {
            throw new Error('Invalid username or password.');
        }

        if (!userData.email) {
            throw new Error('User account is missing an email address. Please contact an administrator.');
        }

        if (userData.status !== 'Active') {
            throw new Error('Your account has been deactivated. Please contact an administrator.');
        }

        if (userData.canAccessWeb === false) {
            throw new Error('This account does not have permission to access the web platform.');
        }
        
        console.log('🔑 Attempting Supabase auth for:', userData.email);
        const { data, error: authError } = await Promise.race([
          supabase.auth.signInWithPassword({
            email: userData.email,
            password: password,
          }),
          new Promise<any>((_, reject) =>
            setTimeout(() => reject(new Error('Auth timeout - check Supabase connection')), ABORT_DELAY)
          )
        ]);

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
                woredaId: userData.woredaId,
                status: userData.status as 'Active' | 'Inactive',
                canAccessWeb: userData.canAccessWeb,
                canAccessMobile: userData.canAccessMobile,
                lastLogin: new Date().toISOString()
            });
        }
    } catch (err: any) {
        const errorMsg = err.name === 'AbortError' ? `Login timeout: ${err.message}` : (err.message || 'Login failed');
        console.error('❌ Login error:', err);
        setError(errorMsg);
    } finally {
        clearTimeout(timeoutId);
        setIsLoading(false);
        console.log('⏹️ Login process ended');
    }
  }, []);

  const clearAuthData = useCallback(async () => {
    await robustCleanup();
    
    setIsLoggedIn(false);
    setUserRole(UserRole.None);
    setCurrentUser(null);
    setError('');
    resetAllViews();
  }, []);

  const handleLogout = async (): Promise<void> => {
    await clearAuthData();
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
        return <VehicleRegistrationFlow onBack={() => setClerkView('dashboard')} currentUser={currentUser} />;
      case 'new-license':
        if (isOfficer) return <ClerkDashboard onNavigate={setClerkView} userRole={userRole} />;
        return <DriverLicenseFlow onBack={() => setClerkView('dashboard')} currentUser={currentUser} />;
      case 'payments':
        if (isOfficer) return <ClerkDashboard onNavigate={setClerkView} userRole={userRole} />;
        return <PaymentProcessingScreen onBack={() => setClerkView('dashboard')} />;
      case 'plates':
        if (isOfficer) return <ClerkDashboard onNavigate={setClerkView} userRole={userRole} />;
        return <ClerkPlateManagementScreen onBack={() => setClerkView('dashboard')} />;
      case 'vehicles':
        return <VehicleRegistryScreen onBack={() => setClerkView('dashboard')} />;
      case 'drivers':
        return <DriverRegistryScreen onBack={() => setClerkView('dashboard')} currentUser={currentUser} />;
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
