
import React, { useState, useEffect } from 'react';
import { UserRole, User } from '../../types';
import { getUsers, updateUser, addUser, addAuditLog } from '../../database';
import { useToast } from '../../context/ToastContext';
import { FaUserPlus, FaShieldAlt } from 'react-icons/fa';
import { supabase } from '../../supabaseClient';

interface UserManagementScreenProps {
  onBack: () => void;
}

const UserManagementScreen: React.FC<UserManagementScreenProps> = ({ onBack }) => {
    const { addToast } = useToast();
    const [users, setUsers] = useState<User[]>([]);
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
        const fetchUsers = async () => {
            const data = await getUsers();
            setUsers(data);
        };
        fetchUsers();
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

            addToast(`User ${user.name} has been ${newStatus === 'Active' ? 'activated' : 'deactivated'}`, "success");
        } catch (error) {
            addToast("Failed to update user status", "error");
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
                    addToast("All fields are required", "error");
                    return;
                }

                if (!validatePassword(newUser.password)) {
                    addToast("Password must be at least 8 characters", "error");
                    return;
                }

                // 1. Create in Supabase Auth
                const { data: authData, error: authError } = await supabase.auth.signUp({
                    email: newUser.email,
                    password: newUser.password,
                    options: {
                        data: {
                            full_name: newUser.name,
                            username: newUser.username,
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
                        user: 'Admin',
                        role: 'Admin',
                        details: `Created new user: ${newUser.username} (${newUser.role})`,
                        status: 'success',
                        ipAddress: 'internal'
                    });

                    setUsers([...users, createdUser]);
                    addToast(`User ${createdUser.name} created successfully`, "success");
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
                addToast(`User ${selectedUser.name} updated successfully`, "success");
            }
            setShowEditModal(false);
            setSelectedUser(null);
        } catch (error: any) {
            addToast(error.message || "An error occurred", "error");
        } finally {
            setIsLoading(false);
        }
    }

    const handlePasswordReset = async () => {
        if (!selectedUser || !resetPasswordValue.trim()) return;
        
        if (!validatePassword(resetPasswordValue)) {
            addToast("Password must be at least 8 characters", "error");
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

            addToast("Password reset successfully!", "success");
            setResetPasswordValue('');
        } catch (error: any) {
            addToast(error.message || "Failed to reset password", "error");
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
                    User Management
                </h1>
                <p className="text-gray-500">Manage system access and roles. (Closed System)</p>
            </div>
            <div className="flex gap-3">
                 <button
                    onClick={onBack}
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
                >
                    Back to Dashboard
                </button>
                <button 
                    onClick={handleCreateClick}
                    className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
                >
                    <FaUserPlus size={20} />
                    Add New User
                </button>
            </div>
        </div>

        {/* User Table */}
        <div className="overflow-x-auto bg-gray-50 rounded-lg border border-gray-200">
            <table className="w-full text-sm text-left text-gray-500">
                <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                    <tr>
                        <th scope="col" className="px-6 py-3">Name</th>
                        <th scope="col" className="px-6 py-3">Username / Email</th>
                        <th scope="col" className="px-6 py-3">Role</th>
                        <th scope="col" className="px-6 py-3">Status</th>
                        <th scope="col" className="px-6 py-3 text-right">Actions</th>
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
                            <td className="px-6 py-4">
                                <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                                    user.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                }`}>
                                    <span className={`h-1.5 w-1.5 rounded-full ${user.status === 'Active' ? 'bg-green-600' : 'bg-red-600'}`}></span>
                                    {user.status}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                                <button onClick={() => handleEditClick(user)} className="font-medium text-blue-600 hover:underline px-2">Edit</button>
                                <button 
                                    onClick={() => handleDeactivate(user)} 
                                    className={`font-medium hover:underline px-2 ${user.status === 'Active' ? 'text-red-600' : 'text-green-600'}`}
                                >
                                    {user.status === 'Active' ? 'Deactivate' : 'Activate'}
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>

      {/* Edit/Create User Modal */}
      {showEditModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
              <div className="bg-white p-5 rounded-lg shadow-xl w-full max-w-sm animate-fade-in">
                  <h3 className="text-lg font-bold mb-3 text-gray-900">{isCreating ? 'Register New User' : `Edit User: ${selectedUser?.name}`}</h3>
                  <form onSubmit={(e) => { e.preventDefault(); handleSaveChanges(); }}>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-medium mb-1 text-gray-700">Full Name</label>
                            <input 
                                type="text" 
                                required
                                value={isCreating ? newUser.name : selectedUser?.name} 
                                onChange={e => isCreating ? setNewUser({...newUser, name: e.target.value}) : setSelectedUser({...selectedUser!, name: e.target.value})}
                                className="w-full p-1.5 text-sm border rounded bg-white"
                                placeholder="e.g. John Doe"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1 text-gray-700">Email Address</label>
                            <input 
                                type="email" 
                                required
                                value={isCreating ? newUser.email : selectedUser?.email} 
                                onChange={e => isCreating ? setNewUser({...newUser, email: e.target.value}) : setSelectedUser({...selectedUser!, email: e.target.value})}
                                className="w-full p-1.5 text-sm border rounded bg-white"
                                placeholder="user@example.com"
                                readOnly={!isCreating}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1 text-gray-700">Username</label>
                            <input 
                                type="text" 
                                required
                                value={isCreating ? newUser.username : selectedUser?.username} 
                                onChange={e => isCreating ? setNewUser({...newUser, username: e.target.value}) : setSelectedUser({...selectedUser!, username: e.target.value})}
                                className="w-full p-1.5 text-sm border rounded bg-white"
                                placeholder="e.g. jdoe"
                                readOnly={!isCreating}
                            />
                        </div>
                        <div>
                            <label htmlFor="role" className="block text-xs font-medium mb-1 text-gray-700">Role</label>
                            <select 
                                id="role" 
                                value={isCreating ? newUser.role : selectedUser?.role} 
                                onChange={e => isCreating ? setNewUser({...newUser, role: e.target.value as UserRole}) : setSelectedUser({...selectedUser!, role: e.target.value as UserRole})} 
                                className="w-full p-1.5 text-sm border rounded bg-white"
                            >
                                {Object.values(UserRole).filter(r => r !== UserRole.None).map(role => <option key={role} value={role}>{role}</option>)}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-2 p-2 bg-blue-50/50 rounded-lg border border-blue-100">
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input 
                                    type="checkbox"
                                    checked={isCreating ? newUser.canAccessWeb : selectedUser?.canAccessWeb}
                                    onChange={e => isCreating ? setNewUser({...newUser, canAccessWeb: e.target.checked}) : setSelectedUser({...selectedUser!, canAccessWeb: e.target.checked})}
                                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                />
                                <span className="text-xs font-medium text-gray-700 group-hover:text-blue-600 transition">Web Access</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input 
                                    type="checkbox"
                                    checked={isCreating ? newUser.canAccessMobile : selectedUser?.canAccessMobile}
                                    onChange={e => isCreating ? setNewUser({...newUser, canAccessMobile: e.target.checked}) : setSelectedUser({...selectedUser!, canAccessMobile: e.target.checked})}
                                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                />
                                <span className="text-xs font-medium text-gray-700 group-hover:text-blue-600 transition">Mobile Access</span>
                            </label>
                        </div>
                        
                        {isCreating && (
                             <div>
                                <label className="block text-xs font-medium mb-1 text-gray-700">Password</label>
                                <input 
                                    type="password" 
                                    required
                                    value={newUser.password}
                                    onChange={e => setNewUser({...newUser, password: e.target.value})}
                                    className="w-full p-1.5 text-sm border rounded bg-white" 
                                    placeholder="At least 8 characters"
                                />
                                <p className="text-[10px] text-gray-500 mt-0.5">Provide a secure password for the user.</p>
                            </div>
                        )}

                        {!isCreating && (
                             <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                <label className="block text-xs font-medium mb-1.5 text-gray-700">Security: Reset Password</label>
                                 <div className="flex gap-2">
                                     <input 
                                        type="password" 
                                        value={resetPasswordValue}
                                        onChange={(e) => setResetPasswordValue(e.target.value)}
                                        placeholder="New password"
                                        className="flex-1 p-1.5 text-xs border rounded bg-white"
                                     />
                                     <button 
                                        type="button" 
                                        onClick={handlePasswordReset}
                                        className="px-2.5 py-1.5 bg-yellow-600 text-white text-xs font-semibold rounded hover:bg-yellow-700 transition"
                                     >
                                        Reset
                                     </button>
                                 </div>
                            </div>
                        )}
                    </div>
                      <div className="flex justify-end gap-2 mt-6 pt-3 border-t border-gray-200">
                          <button type="button" onClick={() => setShowEditModal(false)} className="px-3 py-1.5 text-sm bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition" disabled={isSaving}>Cancel</button>
                          <button type="submit" className="px-3 py-1.5 text-sm bg-blue-600 text-white font-semibold rounded hover:bg-blue-700 transition disabled:bg-blue-400" disabled={isSaving}>
                              {isSaving ? 'Saving...' : (isCreating ? 'Register User' : 'Save Changes')}
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
