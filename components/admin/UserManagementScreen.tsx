
import React, { useState, useEffect } from 'react';
import { UserRole, User } from '../../types';
import { getUsers, updateUser, addUser, addAuditLog, getWoredas } from '../../database';
import { useToast } from '../../context/ToastContext';
import { FaUserPlus, FaShieldAlt } from 'react-icons/fa';
import { supabase } from '../../supabaseClient';
import { useTranslation } from 'react-i18next';

interface UserManagementScreenProps {
  onBack: () => void;
  currentUser: User | null;
}

const UserManagementScreen: React.FC<UserManagementScreenProps> = ({ onBack, currentUser }) => {
    const { t } = useTranslation();
    const { addToast } = useToast();
    const [users, setUsers] = useState<User[]>([]);
    const [woredas, setWoredas] = useState<any[]>([]);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [resetPasswordValue, setResetPasswordValue] = useState('');
    const [isSaving, setIsLoading] = useState(false);
    
    // New User State
    const [newUser, setNewUser] = useState<Partial<User>>({
        name: '',
        username: '',
        email: '',
        role: UserRole.Clerk,
        status: 'Active',
        password: '',
        canAccessWeb: true,
        canAccessMobile: false,
    });

    useEffect(() => {
        const fetchData = async () => {
            const [userData, woredaData] = await Promise.all([
                getUsers(),
                getWoredas()
            ]);
            setUsers(userData);
            setWoredas(woredaData);
        };
        fetchData();
    }, []);

    const handleDeactivate = async (user: User) => {
        const newStatus: 'Active' | 'Inactive' = user.status === 'Active' ? 'Inactive' : 'Active';
        const updatedUser = { ...user, status: newStatus };
        
        try {
            await updateUser(updatedUser);
            setUsers(users.map(u => u.id === user.id ? updatedUser : u));
            
            await addAuditLog({
                action: `USER_STATUS_CHANGE`,
                user: 'Admin', // In a real app, get from auth context
                role: 'Admin',
                details: `Changed status for user ${user.username} to ${newStatus}`,
                status: 'success',
                ipAddress: 'internal'
            });

            addToast(t('userStatusChanged', { name: user.name, status: newStatus === 'Active' ? t('activated') : t('deactivated') }), "success");
        } catch (error) {
            addToast(t('failedToUpdateStatus'), "error");
        }
    };

    const handleEditClick = (user: User) => {
        setIsCreating(false);
        setSelectedUser({ ...user }); 
        setResetPasswordValue(''); 
        setShowEditModal(true);
    };
    
    const handleCreateClick = () => {
        setIsCreating(true);
        setNewUser({
            name: '',
            username: '',
            email: '',
            role: UserRole.Clerk,
            status: 'Active',
            password: '',
            canAccessWeb: true,
            canAccessMobile: false,
        });
        setShowEditModal(true);
    };

    const validatePassword = (pass: string) => {
        return pass.length >= 8; 
    };

    const handleSaveChanges = async () => {
        setIsLoading(true);
        try {
            if (isCreating) {
                // Validation
                if (!newUser.name || !newUser.username || !newUser.email || !newUser.password) {
                    addToast(t('allFieldsRequired'), "error");
                    return;
                }

                if (!validatePassword(newUser.password)) {
                    addToast(t('passwordMinLength'), "error");
                    return;
                }

                const targetWoredaId = currentUser?.role === UserRole.WoredaAdmin ? currentUser.woredaId : newUser.woredaId;

                // 1. Create in Supabase Auth
                const { data: authData, error: authError } = await supabase.auth.signUp({
                    email: newUser.email,
                    password: newUser.password,
                    options: {
                        data: {
                            full_name: newUser.name,
                            username: newUser.username,
                            role: newUser.role,
                            woreda_id: targetWoredaId
                        }
                    }
                });

                if (authError) throw authError;

                if (authData.user) {
                    const createdUser: User = {
                        id: authData.user.id,
                        name: newUser.name!,
                        username: newUser.username!,
                        email: newUser.email!,
                        role: newUser.role || UserRole.Clerk,
                        woredaId: targetWoredaId,
                        lastLogin: 'Never',
                        status: 'Active',
                        password: newUser.password,
                        canAccessWeb: newUser.canAccessWeb ?? true,
                        canAccessMobile: newUser.canAccessMobile ?? false
                    };

                    // 2. Add to our users table
                    await addUser(createdUser);
                    
                    await addAuditLog({
                        action: 'USER_CREATED',
                        user: currentUser?.username || 'Admin',
                        role: currentUser?.role || 'Admin',
                        details: `Created new user: ${newUser.username} (${newUser.role}) in Woreda: ${createdUser.woredaId || 'Global'}`,
                        status: 'success',
                        ipAddress: 'internal'
                    });

                    setUsers([...users, createdUser]);
                    addToast(t('userCreatedSuccess', { name: createdUser.name }), "success");
                }
            } else if (selectedUser) {
                const oldUser = users.find(u => u.id === selectedUser.id);
                await updateUser(selectedUser);
                
                if (oldUser && oldUser.role !== selectedUser.role) {
                    await addAuditLog({
                        action: 'ROLE_ASSIGNMENT',
                        user: 'Admin',
                        role: 'Admin',
                        details: `Changed role for ${selectedUser.username} from ${oldUser.role} to ${selectedUser.role}`,
                        status: 'success',
                        ipAddress: 'internal'
                    });
                }

                setUsers(users.map(u => u.id === selectedUser.id ? selectedUser : u));
                addToast(t('userUpdatedSuccess', { name: selectedUser.name }), "success");
            }
            setShowEditModal(false);
            setSelectedUser(null);
        } catch (error: any) {
            addToast(error.message || t('errorOccurred'), "error");
        } finally {
            setIsLoading(false);
        }
    }

    const handlePasswordReset = async () => {
        if (!selectedUser || !resetPasswordValue.trim()) return;
        
        if (!validatePassword(resetPasswordValue)) {
            addToast(t('passwordMinLength'), "error");
            return;
        }

        setIsLoading(true); // Show loading state
        try {
            // Update in public.users table
            await updateUser({
                ...selectedUser,
                password: resetPasswordValue
            });
            
            await addAuditLog({
                action: 'PASSWORD_RESET',
                user: 'Admin',
                role: 'Admin',
                details: `Updated password for user ${selectedUser.username}`,
                status: 'success',
                ipAddress: 'internal'
            });

            addToast(t('passwordResetSuccess'), "success");
            setResetPasswordValue('');
        } catch (error: any) {
            addToast(error.message || t('failedToResetPassword'), "error");
        } finally {
            setIsLoading(false);
        }
    }
    
  return (
    <div className="p-4 md:p-8">
      <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-xl p-8 border border-gray-100">
        <div className="flex justify-between items-center mb-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <span className="text-blue-600"><FaShieldAlt /></span>
                    {t('userManagement')}
                </h1>
                <p className="text-gray-500">{t('userManagementSubtitle')}</p>
            </div>
            <div className="flex gap-3">
                 <button
                    onClick={onBack}
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
                >
                    {t('backToDashboard')}
                </button>
                <button 
                    onClick={handleCreateClick}
                    className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
                >
                    <FaUserPlus size={20} />
                    {t('addNewUser')}
                </button>
            </div>
        </div>

        {/* User Table */}
        <div className="overflow-x-auto bg-gray-50 rounded-lg border border-gray-200">
            <table className="w-full text-sm text-left text-gray-500">
                <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                    <tr>
                        <th scope="col" className="px-6 py-3">{t('name')}</th>
                        <th scope="col" className="px-6 py-3">{t('usernameEmail')}</th>
                        <th scope="col" className="px-6 py-3">{t('role')}</th>
                        {currentUser?.role === UserRole.Admin && <th scope="col" className="px-6 py-3">Woreda</th>}
                        <th scope="col" className="px-6 py-3">{t('status')}</th>
                        <th scope="col" className="px-6 py-3 text-right">{t('actions')}</th>
                    </tr>
                </thead>
                <tbody>
                    {users.map(user => (
                        <tr key={user.id} className={`border-b transition ${user.status === 'Inactive' ? 'bg-gray-100/50' : 'bg-white hover:bg-gray-50'}`}>
                            <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap flex items-center gap-3">
                                <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs ${user.status === 'Inactive' ? 'bg-gray-200 text-gray-400' : 'bg-blue-100 text-blue-600'}`}>
                                    {user.name.charAt(0)}
                                </div>
                                <div className="flex flex-col">
                                    <span className={user.status === 'Inactive' ? 'text-gray-400 line-through' : ''}>{user.name}</span>
                                    <span className="text-[10px] text-gray-400 font-normal">{user.id}</span>
                                </div>
                            </th>
                            <td className={`px-6 py-4 ${user.status === 'Inactive' ? 'text-gray-400' : ''}`}>
                                <div>{user.username}</div>
                                <div className="text-xs text-gray-400">{user.email}</div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex flex-col gap-1">
                                    <span className={`px-2 py-1 rounded text-xs font-bold border w-fit ${
                                        user.status === 'Inactive' ? 'bg-gray-100 text-gray-400 border-gray-200' :
                                        user.role === UserRole.Admin ? 'bg-purple-100 text-purple-700 border-purple-200' :
                                        user.role === UserRole.Officer ? 'bg-green-100 text-green-700 border-green-200' :
                                        'bg-blue-100 text-blue-700 border-blue-200'
                                    }`}>
                                        {user.role}
                                    </span>
                                    <div className="flex gap-1">
                                        {user.canAccessWeb && (
                                            <span className="text-[10px] bg-gray-100 text-gray-600 px-1 rounded border border-gray-200" title="Web Access">WEB</span>
                                        )}
                                        {user.canAccessMobile && (
                                            <span className="text-[10px] bg-gray-100 text-gray-600 px-1 rounded border border-gray-200" title="Mobile Access">MOB</span>
                                        )}
                                    </div>
                                </div>
                            </td>
                            {currentUser?.role === UserRole.Admin && (
                                <td className="px-6 py-4">
                                    <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded border border-gray-200">
                                        {woredas.find(w => w.id === user.woredaId)?.name || 'Global'}
                                    </span>
                                </td>
                            )}
                            <td className="px-6 py-4">
                                <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                                    user.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                }`}>
                                    <span className={`h-1.5 w-1.5 rounded-full ${user.status === 'Active' ? 'bg-green-600' : 'bg-red-600'}`}></span>
                                    {user.status === 'Active' ? t('active') : t('inactive')}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                                <div className="flex justify-end gap-2">
                                    {(currentUser?.role === UserRole.Admin || (currentUser?.role === UserRole.WoredaAdmin && (user.role === UserRole.Officer || user.role === UserRole.Clerk))) && (
                                        <>
                                            <button onClick={() => handleEditClick(user)} className="font-medium text-blue-600 hover:underline px-2">{t('edit')}</button>
                                            <button 
                                                onClick={() => handleDeactivate(user)} 
                                                className={`font-medium hover:underline px-2 ${user.status === 'Active' ? 'text-red-600' : 'text-green-600'}`}
                                            >
                                                {user.status === 'Active' ? t('deactivate') : t('activate')}
                                            </button>
                                        </>
                                    )}
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>

      {/* Edit/Create User Modal */}
      {showEditModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
              <div className="bg-white p-5 rounded-lg shadow-xl w-full max-w-lg my-8 animate-fade-in">
                  <h3 className="text-lg font-bold mb-3 text-gray-900">{isCreating ? t('registerNewUser') : t('editUser', { name: selectedUser?.name })}</h3>
                  <form onSubmit={(e) => { e.preventDefault(); handleSaveChanges(); }}>
                    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium mb-1 text-gray-700">{t('fullName')}</label>
                                <input 
                                    type="text" 
                                    required
                                    value={isCreating ? newUser.name : selectedUser?.name} 
                                    onChange={e => isCreating ? setNewUser({...newUser, name: e.target.value}) : setSelectedUser({...selectedUser!, name: e.target.value})}
                                    className="w-full p-2 text-sm border rounded bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="e.g. John Doe"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1 text-gray-700">{t('emailAddress')}</label>
                                <input 
                                    type="email" 
                                    required
                                    value={isCreating ? newUser.email : selectedUser?.email} 
                                    onChange={e => isCreating ? setNewUser({...newUser, email: e.target.value}) : setSelectedUser({...selectedUser!, email: e.target.value})}
                                    className="w-full p-2 text-sm border rounded bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="user@example.com"
                                    readOnly={!isCreating}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium mb-1 text-gray-700">{t('username')}</label>
                                <input 
                                    type="text" 
                                    required
                                    value={isCreating ? newUser.username : selectedUser?.username} 
                                    onChange={e => isCreating ? setNewUser({...newUser, username: e.target.value}) : setSelectedUser({...selectedUser!, username: e.target.value})}
                                    className="w-full p-2 text-sm border rounded bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="e.g. jdoe"
                                    readOnly={!isCreating}
                                />
                            </div>
                            <div>
                                <label htmlFor="role" className="block text-xs font-medium mb-1 text-gray-700">{t('role')}</label>
                                <select 
                                    id="role" 
                                    value={isCreating ? newUser.role : selectedUser?.role} 
                                    onChange={e => isCreating ? setNewUser({...newUser, role: e.target.value as UserRole}) : setSelectedUser({...selectedUser!, role: e.target.value as UserRole})} 
                                    className="w-full p-2 text-sm border rounded bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    {Object.values(UserRole)
                                        .filter(r => r !== UserRole.None)
                                        .filter(r => {
                                            if (currentUser?.role === UserRole.WoredaAdmin) {
                                                return r === UserRole.Clerk || r === UserRole.Officer;
                                            }
                                            return true;
                                        })
                                        .map(role => <option key={role} value={role}>{role}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Woreda Selection - Hidden for WoredaAdmin */}
                        {currentUser?.role === UserRole.Admin && (
                            <div>
                                <label htmlFor="woreda" className="block text-xs font-medium mb-1 text-gray-700">Woreda / District</label>
                                <select 
                                    id="woreda" 
                                    value={isCreating ? (newUser.woredaId || '') : (selectedUser?.woredaId || '')} 
                                    onChange={e => {
                                        const val = e.target.value || undefined;
                                        isCreating ? setNewUser({...newUser, woredaId: val}) : setSelectedUser({...selectedUser!, woredaId: val});
                                    }} 
                                    className="w-full p-2 text-sm border rounded bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="">Global / No Woreda</option>
                                    {woredas.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                            </div>
                        )}

                        <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                            <p className="text-xs font-bold text-blue-700 mb-3 uppercase tracking-wider">Access Permissions</p>
                            <div className="grid grid-cols-2 gap-4">
                                <label className="flex items-center gap-3 cursor-pointer group p-2 bg-white rounded border border-blue-100 hover:border-blue-300 transition">
                                    <input 
                                        type="checkbox"
                                        checked={isCreating ? newUser.canAccessWeb : selectedUser?.canAccessWeb}
                                        onChange={e => isCreating ? setNewUser({...newUser, canAccessWeb: e.target.checked}) : setSelectedUser({...selectedUser!, canAccessWeb: e.target.checked})}
                                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                    />
                                    <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600 transition">{t('webAccess')}</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer group p-2 bg-white rounded border border-blue-100 hover:border-blue-300 transition">
                                    <input 
                                        type="checkbox"
                                        checked={isCreating ? newUser.canAccessMobile : selectedUser?.canAccessMobile}
                                        onChange={e => isCreating ? setNewUser({...newUser, canAccessMobile: e.target.checked}) : setSelectedUser({...selectedUser!, canAccessMobile: e.target.checked})}
                                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                    />
                                    <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600 transition">{t('mobileAccess')}</span>
                                </label>
                            </div>
                        </div>
                        
                        {isCreating && (
                             <div>
                                <label className="block text-xs font-medium mb-1 text-gray-700">{t('password')}</label>
                                <input 
                                    type="password" 
                                    required
                                    value={newUser.password}
                                    onChange={e => setNewUser({...newUser, password: e.target.value})}
                                    className="w-full p-2 text-sm border rounded bg-white focus:ring-2 focus:ring-blue-500 outline-none" 
                                    placeholder={t('passwordMinLength')}
                                />
                                <p className="text-[10px] text-gray-500 mt-1">{t('provideSecurePassword')}</p>
                            </div>
                        )}

                        {!isCreating && (
                             <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <label className="block text-xs font-medium mb-2 text-gray-700">{t('securityResetPassword')}</label>
                                 <div className="flex gap-2">
                                     <input 
                                        type="password" 
                                        value={resetPasswordValue}
                                        onChange={(e) => setResetPasswordValue(e.target.value)}
                                        placeholder={t('newPassword')}
                                        className="flex-1 p-2 text-sm border rounded bg-white focus:ring-2 focus:ring-yellow-500 outline-none"
                                     />
                                     <button 
                                        type="button" 
                                        onClick={handlePasswordReset}
                                        className="px-4 py-2 bg-yellow-600 text-white text-xs font-semibold rounded hover:bg-yellow-700 transition"
                                     >
                                        {t('reset')}
                                     </button>
                                 </div>
                            </div>
                        )}
                    </div>
                      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
                          <button type="button" onClick={() => setShowEditModal(false)} className="px-5 py-2 text-sm bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 transition font-medium" disabled={isSaving}>{t('cancel')}</button>
                          <button type="submit" className="px-5 py-2 text-sm bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-md transition disabled:bg-blue-400" disabled={isSaving}>
                              {isSaving ? t('saving') : (isCreating ? t('registerUser') : t('saveChanges'))}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};

export default UserManagementScreen;