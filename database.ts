// database.ts
import { supabase, supabaseAdmin } from './supabaseClient';
import { Vehicle, Driver, Violation, User, SearchResult, Alert, PlateItem, Payment, AuditLog, Woreda } from './types';
import { v4 as uuidv4 } from 'uuid';


// --- Mapping Helpers ---

const mapToCamel = (row: any) => {
    if (!row) return row;
    const mapped: any = {};
    for (const key in row) {
        let value = row[key];
        
        // Handle JSONB fields
        if (key === 'stolen_status' || key === 'payment_history' || key === 'associated_vehicles' || key === 'metadata') {
            try {
                value = typeof row[key] === 'string' ? JSON.parse(row[key]) : (row[key] || (key === 'associated_vehicles' ? [] : {}));
            } catch (e) {
                value = row[key] || (key === 'associated_vehicles' ? [] : {});
            }
        }

        // Convert key to camelCase
        const camelKey = key.replace(/([-_][a-z])/g, group =>
            group.toUpperCase().replace('-', '').replace('_', '')
        );
        
        mapped[camelKey] = value === null ? '' : value;
    }
    return mapped;
};

// --- Woreda API ---
export const getWoredas = async (): Promise<Woreda[]> => {
    const { data, error } = await supabase
        .from('woredas')
        .select('*');
    if (error) throw error;
    return (data || []).map(mapToCamel) as Woreda[];
};

// --- Vehicles API ---
export const getVehicles = async (plateNumber?: string): Promise<Vehicle[]> => {
    let query = supabase
        .from('vehicles')
        .select('*')
        .is('deleted_at', null);
    
    if (plateNumber) {
        query = query.eq('plate_number', plateNumber);
    } else {
        query = query.limit(100); // Default limit for general list
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapToCamel) as Vehicle[];
};

export const updateVehicle = async (vehicle: Vehicle): Promise<void> => {
    const v = vehicle as any;
    const { error } = await supabase
        .from('vehicles')
        .upsert({
            id: v.id,
            plate_number: v.plateNumber,
            make: v.make,
            model: v.model,
            year: v.year,
            type: v.type,
            owner_name: v.ownerName,
            owner_phone: v.ownerPhone,
            status: v.status,
            expiry_date: v.expiryDate,
            stolen_status: v.stolenStatus,
            // Additional fields from Registration Flow
            address: v.address,
            national_id: v.nationalId,
            chassis_number: v.chassisNumber,
            engine_number: v.engineNumber,
            color: v.color,
            fuel_type: v.fuelType,
            updated_at: new Date().toISOString()
        });
    if (error) throw error;
};

export const markVehicleAsStolen = async (vehicleId: string, reportedBy: string): Promise<void> => {
    const status = { isStolen: true, reportedAt: new Date().toISOString(), reportedBy };
    const { error } = await supabase
        .from('vehicles')
        .update({ 
            stolen_status: status,
            status: 'Stolen'
        })
        .eq('id', vehicleId);
    if (error) throw error;
};

export const unmarkVehicleAsStolen = async (vehicleId: string): Promise<void> => {
    const status = { isStolen: false };
    const { error } = await supabase
        .from('vehicles')
        .update({ 
            stolen_status: status,
            status: 'Active'
        })
        .eq('id', vehicleId);
    if (error) throw error;
};

export const transferVehicleOwnership = async (vehicleId: string, newOwner: Driver): Promise<void> => {
    const { error } = await supabase
        .from('vehicles')
        .update({
            owner_name: newOwner.fullName,
            owner_phone: newOwner.phone || ''
        })
        .eq('id', vehicleId);
    if (error) throw error;
};

// --- Drivers API ---
export const getDrivers = async (licenseNumber?: string): Promise<Driver[]> => {
    let query = supabase
        .from('drivers')
        .select('*')
        .is('deleted_at', null);
    
    if (licenseNumber) {
        query = query.eq('license_number', licenseNumber);
    } else {
        query = query.limit(100); // Default limit for general list
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapToCamel) as Driver[];
};

export const updateDriver = async (driver: Driver): Promise<void> => {
    const d = driver as any;
    const { error } = await supabase
        .from('drivers')
        .upsert({
            id: d.id,
            license_number: d.licenseNumber,
            full_name: d.fullName,
            phone: d.phone,
            email: d.email,
            gender: d.gender,
            status: d.status,
            expiry_date: d.expiryDate,
            associated_vehicles: d.associatedVehicles,
            updated_at: new Date().toISOString()
        });
    if (error) throw error;
};

// --- Violations API ---
export const getViolations = async (): Promise<Violation[]> => {
    const { data, error } = await supabase
        .from('violations')
        .select('*')
        .is('deleted_at', null);
    if (error) throw error;
    return (data || []).map(mapToCamel) as Violation[];
};

export const createViolation = async (violation: Omit<Violation, 'id'>): Promise<void> => {
    const v = violation as any;
    const { error } = await supabase
        .from('violations')
        .insert({
            id: uuidv4(),
            violation_type: v.violationType,
            driver_name: v.driverName,
            plate_number: v.plateNumber,
            amount: v.amount,
            status: 'Unpaid'
        });
    if (error) throw error;
};

export const updateViolation = async (violation: Violation): Promise<void> => {
    const v = violation as any;
    const { error } = await supabase
        .from('violations')
        .update({
            status: v.status,
            amount_paid: v.amountPaid,
            payment_history: v.paymentHistory
        })
        .eq('id', v.id);
    if (error) throw error;
};

export const bulkMarkViolationsAsPaid = async (ids: string[]): Promise<void> => {
    const { error } = await supabase
        .from('violations')
        .update({ status: 'Paid' })
        .in('id', ids);
    if (error) throw error;
};

// --- Users API ---
export const getUsers = async (): Promise<User[]> => {
    const { data, error } = await supabase
        .from('users')
        .select('*');
    if (error) throw error;
    return (data || []).map(mapToCamel) as User[];
};

export const addUser = async (user: User): Promise<void> => {
    const u = user as any;
    
    // IMPORTANT: Don't generate a new UUID here!
    // The user.id should already be the auth.users ID
    const { error } = await supabase
        .from('users')
        .upsert({ 
            id: u.id, // Remove the || uuidv4() - this must be the auth.users ID
            name: u.name,
            username: u.username,
            email: u.email,
            password: u.password,
            role: u.role,
            woreda_id: u.woredaId,
            status: u.status || 'Active',
            can_access_web: u.canAccessWeb ?? true,
            can_access_mobile: u.canAccessMobile ?? false
        });
    if (error) throw error;
};

export const updateUser = async (user: User): Promise<void> => {
    const u = user as any;
    const updateData: any = {
        name: u.name,
        username: u.username,
        email: u.email,
        role: u.role,
        woreda_id: u.woredaId,
        status: u.status,
        can_access_web: u.canAccessWeb,
        can_access_mobile: u.canAccessMobile
    };
    
    if (u.password) {
        updateData.password = u.password;
    }

    const { error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', u.id);
    if (error) throw error;
};

// Add or update this in database.ts
export const getUserProfile = async (identifier: string) => {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        // Allow login by either username OR email
        .or(`username.eq.${identifier},email.eq.${identifier}`)
        .maybeSingle();
    
    if (error) throw error;
    return mapToCamel(data) as User;
};


// --- Plates API ---
export const getPlates = async (): Promise<PlateItem[]> => {
    const { data, error } = await supabase
        .from('plates')
        .select('*');
    if (error) throw error;
    return (data || []).map(mapToCamel) as PlateItem[];
};

export const addPlate = async (plate: PlateItem): Promise<void> => {
    const { error } = await supabase
        .from('plates')
        .insert({
            plate_number: plate.plateNumber,
            type: plate.type,
            status: plate.status,
            notes: plate.notes
        });
    if (error) throw error;
};

// --- Helper: Get current user's woreda_id ---
export const getCurrentUserWoreda = async (): Promise<string> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No authenticated user');
    
    const { data, error } = await supabase
        .from('users')
        .select('woreda_id')
        .eq('id', user.id)
        .single();
    
    if (error || !data?.woreda_id) {
        throw new Error('User woreda_id not found');
    }
    
    return data.woreda_id;
};

// --- Payments API ---
export const getPayments = async (): Promise<Payment[]> => {
    const { data, error } = await supabase
        .from('payments')
        .select('*');
    if (error) throw error;
    return (data || []).map(mapToCamel) as Payment[];
};

export const addPayment = async (payment: Payment): Promise<void> => {
    const woredaId = await getCurrentUserWoreda();
    const p = payment as any;
    const { error } = await supabase
        .from('payments')
        .insert({
            id: p.id || uuidv4(),
            woreda_id: woredaId,
            payer_name: p.payerName,
            service_type: p.serviceType,
            amount: p.amount,
            payment_method: p.paymentMethod,
            date: p.date,
            notes: p.notes
        });
    if (error) throw error;
};

// --- Audit Logs API ---
export const getAuditLogs = async (): Promise<AuditLog[]> => {
    try {
        const { data, error } = await supabase
            .from('audit_logs')
            .select('*')
            .order('timestamp', { ascending: false });
        
        if (error) throw error;
        return (data || []).map(mapToCamel) as AuditLog[];
    } catch (error) {
        console.error('Error fetching audit logs:', error);
        throw error;
    }
};

export const addAuditLog = async (log: any): Promise<void> => {
    const { error } = await supabase.rpc('insert_audit_log', {
        p_user: log.user,
        p_role: log.role,
        p_action: log.action,
        p_details: log.details,
        p_ip_address: log.ipAddress,
        p_status: log.status
    });
    if (error) throw error;
};

// --- Applications API ---
export const updateApplication = async (app: any): Promise<void> => {
    const { error } = await supabase
        .from('applications')
        .update({ status: app.status })
        .eq('id', app.id);
    if (error) throw error;
};

// --- Woreda Dashboard API ---
export const getWoredaDashboard = async (woredaId: string): Promise<any> => {
    const { data, error } = await supabase
        .from('woreda_dashboard')
        .select('*')
        .eq('woreda_id', woredaId)
        .single();
    if (error) throw error;
    return mapToCamel(data);
};

// --- Search API ---
export const getSearchResults = async (query?: string): Promise<SearchResult[]> => {
    let vQuery = supabase.from('vehicles').select('id, plate_number').is('deleted_at', null);
    let dQuery = supabase.from('drivers').select('id, full_name').is('deleted_at', null);

    if (query && query.trim()) {
        const searchTerm = `%${query.trim()}%`;
        vQuery = vQuery.ilike('plate_number', searchTerm);
        dQuery = dQuery.ilike('full_name', searchTerm);
    }

    const [{ data: vData, error: vErr }, { data: dData, error: dErr }] = await Promise.all([
        vQuery.limit(50),
        dQuery.limit(50)
    ]);

    if (vErr) throw vErr;
    if (dErr) throw dErr;

    const vehicles = (vData || []).map((v: any) => ({
        id: v.id,
        title: v.plate_number,
        type: 'Vehicle',
        subtitle: `Plate: ${v.plate_number}`
    }));
    const drivers = (dData || []).map((d: any) => ({
        id: d.id,
        title: d.full_name,
        type: 'Driver',
        subtitle: `Name: ${d.full_name}`
    }));
    return [...vehicles, ...drivers] as SearchResult[];
};

// --- Alerts API ---
export const getAlerts = async (): Promise<Alert[]> => {
    const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapToCamel) as Alert[];
};

export const addAlert = async (alert: Omit<Alert, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> => {
    const woredaId = await getCurrentUserWoreda();
    const { error } = await supabase
        .from('alerts')
        .insert({
            id: uuidv4(),
            woreda_id: woredaId,
            category: alert.category,
            type: alert.type,
            title: alert.title,
            description: alert.description,
            priority: alert.priority,
            location: alert.location,
            metadata: alert.metadata || {},
            is_active: alert.isActive
        });
    if (error) throw error;
};

export const updateAlert = async (id: string, updates: Partial<Alert>): Promise<void> => {
    const u = updates as any;
    const payload: any = {};
    if (u.category) payload.category = u.category;
    if (u.type) payload.type = u.type;
    if (u.title) payload.title = u.title;
    if (u.description) payload.description = u.description;
    if (u.priority) payload.priority = u.priority;
    if (u.location) payload.location = u.location;
    if (u.metadata) payload.metadata = u.metadata;
    if (u.isActive !== undefined) payload.is_active = u.isActive;
    payload.updated_at = new Date().toISOString();

    const { error } = await supabase
        .from('alerts')
        .update(payload)
        .eq('id', id);
    if (error) throw error;
};

// --- Password Reset API ---
export const resetPasswordForUser = async (userId: string, newPassword: string): Promise<void> => {
    try {
        // Update Supabase Auth password (service role)
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
            userId,
            { password: newPassword }
        );
        if (authError) throw authError;

        // Update custom users table password for consistency
        const { error: dbError } = await supabase
            .from('users')
            .update({ password: newPassword })
            .eq('id', userId);
        if (dbError) throw dbError;

        console.log(`Password reset successful for user ${userId}`);
    } catch (error: any) {
        console.error('Password reset failed:', error);
        throw new Error(`Failed to reset password: ${error.message}`);
    }
};
