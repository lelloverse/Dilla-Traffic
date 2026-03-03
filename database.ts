// database.ts
import { supabase } from './supabaseClient';
import { Vehicle, Driver, Violation, User, SearchResult, Alert } from './types';
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

// --- Vehicles API ---
export const getVehicles = async (): Promise<Vehicle[]> => {
    const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .is('deleted_at', null);
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
            stolen_status: v.stolen_status,
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
        .update({ stolen_status: status })
        .eq('id', vehicleId);
    if (error) throw error;
};

export const unmarkVehicleAsStolen = async (vehicleId: string): Promise<void> => {
    const status = { isStolen: false };
    const { error } = await supabase
        .from('vehicles')
        .update({ stolen_status: status })
        .eq('id', vehicleId);
    if (error) throw error;
};

export const transferVehicleOwnership = async (vehicleId: string, newOwner: any): Promise<void> => {
    const { error } = await supabase
        .from('vehicles')
        .update({
            owner_name: newOwner.fullName || newOwner.name,
            owner_phone: newOwner.phone || ''
        })
        .eq('id', vehicleId);
    if (error) throw error;
};

// --- Drivers API ---
export const getDrivers = async (): Promise<Driver[]> => {
    const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .is('deleted_at', null);
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
            payment_history: JSON.stringify(v.paymentHistory)
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
    const { error } = await supabase
        .from('users')
        .insert({
            id: u.id || uuidv4(),
            name: u.name,
            username: u.username,
            email: u.email,
            password: u.password,
            role: u.role,
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

// --- Plates API ---
export const getPlates = async (): Promise<any[]> => {
    const { data, error } = await supabase
        .from('plates')
        .select('*');
    if (error) throw error;
    return (data || []).map(mapToCamel);
};

export const addPlate = async (plate: any): Promise<void> => {
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

// --- Payments API ---
export const getPayments = async (): Promise<any[]> => {
    const { data, error } = await supabase
        .from('payments')
        .select('*');
    if (error) throw error;
    return (data || []).map(mapToCamel);
};

export const addPayment = async (payment: any): Promise<void> => {
    const p = payment as any;
    const { error } = await supabase
        .from('payments')
        .insert({
            id: p.id || uuidv4(),
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
export const getAuditLogs = async (): Promise<any[]> => {
    const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('timestamp', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapToCamel);
};

export const addAuditLog = async (log: any): Promise<void> => {
    const { error } = await supabase
        .from('audit_logs')
        .insert({
            id: uuidv4(),
            user: log.user,
            role: log.role,
            action: log.action,
            details: log.details,
            ip_address: log.ipAddress,
            status: log.status
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

// --- Search API ---
export const getSearchResults = async (): Promise<SearchResult[]> => {
    const [{ data: vData, error: vErr }, { data: dData, error: dErr }] = await Promise.all([
        supabase.from('vehicles').select('id, plate_number').is('deleted_at', null),
        supabase.from('drivers').select('id, full_name').is('deleted_at', null)
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
    const { error } = await supabase
        .from('alerts')
        .insert({
            id: uuidv4(),
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
