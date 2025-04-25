import { create } from 'zustand';
import axios from 'axios';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Employee {
  id: number;
  name: string;
  email: string;
  phone: string;
  employee_number: string;
  department: string;
  designation: string;
  can_submit_expenses_anytime: boolean;
  shift_status: string;
  created_at: string;
}

interface TrackingPermission {
  id: number;
  user_id: number;
  user_name: string;
  can_override_geofence: boolean;
  tracking_precision: "low" | "medium" | "high";
  location_required_for_shift: boolean;
  updated_at: string;
}

interface MergedEmployee extends TrackingPermission {
  employee_number?: string;
  email?: string;
  department?: string;
  designation?: string;
  can_submit_expenses_anytime?: boolean;
}

interface TrackingPermissionsState {
  employees: Employee[];
  trackingPermissions: TrackingPermission[];
  expensePermissions: any[];
  mergedData: MergedEmployee[];
  isLoading: boolean;
  isUpdating: boolean;
  searchQuery: string;
  error: string | null;
  fetchEmployees: (token: string) => Promise<void>;
  fetchTrackingPermissions: (token: string) => Promise<void>;
  fetchExpensePermissions: (token: string) => Promise<void>;
  updateTrackingPermission: (
    token: string,
    userId: number,
    field:
      | "can_override_geofence"
      | "tracking_precision"
      | "location_required_for_shift",
    value: boolean | string
  ) => Promise<void>;
  updateExpensePermission: (
    token: string,
    userId: number,
    value: boolean
  ) => Promise<void>;
  setSearchQuery: (query: string) => void;
  refreshData: (token: string) => Promise<void>;
}

export const useTrackingPermissionsStore = create<TrackingPermissionsState>()(
  persist(
    (set, get) => ({
      employees: [],
      trackingPermissions: [],
      expensePermissions: [],
      mergedData: [],
      isLoading: false,
      isUpdating: false,
      searchQuery: "",
      error: null,

      fetchEmployees: async (token: string) => {
        try {
          set({ isLoading: true, error: null });

          const response = await axios.get(
            `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin/employees`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
            }
          );

          // Ensure each employee has a unique ID
          const uniqueEmployees = Array.from(
            new Map(
              response.data.map(
                (emp: Employee) => [emp.id, emp] as [number, Employee]
              )
            ).values()
          ) as Employee[];

          set({ employees: uniqueEmployees });

          // Merge data with tracking permissions
          const { trackingPermissions } = get();
          if (trackingPermissions.length > 0) {
            const merged = mergeEmployeeData(
              uniqueEmployees,
              trackingPermissions,
              []
            );
            set({ mergedData: merged });
          }
        } catch (error) {
          console.error("Error fetching employees:", error);
          set({ error: "Failed to fetch employees data" });
        } finally {
          set({ isLoading: false });
        }
      },

      fetchTrackingPermissions: async (token: string) => {
        try {
          set({ isLoading: true, error: null });

          const response = await axios.get(
            `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin-tracking/employees`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
            }
          );

          const uniquePermissions = Array.from(
            new Map(
              response.data.map((perm: TrackingPermission) => [
                perm.user_id,
                perm,
              ])
            ).values()
          ) as TrackingPermission[];

          set({ trackingPermissions: uniquePermissions });

          const { employees, expensePermissions } = get();
          if (employees.length > 0) {
            const merged = mergeEmployeeData(
              employees,
              uniquePermissions,
              expensePermissions
            );
            set({ mergedData: merged });
          }
        } catch (error) {
          console.error("Error fetching tracking permissions:", error);
          set({ error: "Failed to fetch tracking permissions" });
        } finally {
          set({ isLoading: false });
        }
      },

      fetchExpensePermissions: async (token: string) => {
        try {
          set({ isLoading: true, error: null });

          const response = await axios.get(
            `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin/employee-expense-permissions`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
            }
          );

          set({ expensePermissions: response.data });

          const { employees, trackingPermissions } = get();
          if (employees.length > 0) {
            const merged = mergeEmployeeData(
              employees,
              trackingPermissions,
              response.data
            );
            set({ mergedData: merged });
          }
        } catch (error) {
          console.error("Error fetching expense permissions:", error);
          set({ error: "Failed to fetch expense permissions" });
        } finally {
          set({ isLoading: false });
        }
      },

      updateTrackingPermission: async (token, userId, field, value) => {
        try {
          set({ isUpdating: true, error: null });

          const { trackingPermissions } = get();
          const currentPermission = trackingPermissions.find(
            (perm) => perm.user_id === userId
          );

          if (!currentPermission) {
            throw new Error("User permission not found");
          }

          const payload = {
            user_id: userId,
            can_override_geofence: currentPermission.can_override_geofence,
            tracking_precision: currentPermission.tracking_precision,
            location_required_for_shift:
              currentPermission.location_required_for_shift,
          };

          if (
            field === "can_override_geofence" ||
            field === "location_required_for_shift"
          ) {
            payload[field] = value as boolean;
          } else if (field === "tracking_precision") {
            payload.tracking_precision = value as "low" | "medium" | "high";
          }

          await axios.put(
            `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin-tracking/employee-settings`,
            payload,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
            }
          );

          const { employees, expensePermissions } = get();
          const updatedPermissions = trackingPermissions.map((perm) =>
            perm.user_id === userId ? { ...perm, [field]: value } : perm
          );

          set({ trackingPermissions: updatedPermissions });

          if (employees.length > 0) {
            const merged = mergeEmployeeData(
              employees,
              updatedPermissions,
              expensePermissions
            );
            set({ mergedData: merged });
          }
        } catch (error) {
          console.error("Error updating tracking permission:", error);
          set({ error: "Failed to update tracking permission" });
        } finally {
          set({ isUpdating: false });
        }
      },

      updateExpensePermission: async (token, userId, value) => {
        try {
          set({ isUpdating: true, error: null });

          await axios.put(
            `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin/employee-expense-permissions/${userId}`,
            {
              can_submit_expenses_anytime: value,
            },
            {
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
            }
          );

          const { expensePermissions } = get();
          const updatedPermissions = expensePermissions.map((perm) =>
            perm.user_id === userId
              ? { ...perm, can_submit_expenses_anytime: value }
              : perm
          );

          set({ expensePermissions: updatedPermissions });

          const { employees, trackingPermissions } = get();
          if (employees.length > 0) {
            const merged = mergeEmployeeData(
              employees,
              trackingPermissions,
              updatedPermissions
            );
            set({ mergedData: merged });
          }
        } catch (error) {
          console.error("Error updating expense permission:", error);
          set({ error: "Failed to update expense permission" });
        } finally {
          set({ isUpdating: false });
        }
      },

      setSearchQuery: (query: string) => {
        set({ searchQuery: query });
      },

      refreshData: async (token: string) => {
        try {
          set({ isLoading: true, error: null });

          await Promise.all([
            get().fetchEmployees(token),
            get().fetchTrackingPermissions(token),
            get().fetchExpensePermissions(token),
          ]);
        } catch (error) {
          console.error("Error refreshing data:", error);
          set({ error: "Failed to refresh data" });
        } finally {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: "tracking-permissions-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        employees: state.employees,
        trackingPermissions: state.trackingPermissions,
        expensePermissions: state.expensePermissions,
        mergedData: state.mergedData,
      }),
    }
  )
);

// Helper function to merge employee data with tracking permissions
function mergeEmployeeData(
  employees: Employee[],
  trackingPermissions: TrackingPermission[],
  expensePermissions: any[]
): MergedEmployee[] {
  const employeeMap = new Map<number, Employee>();
  const expenseMap = new Map<number, any>();

  employees.forEach((emp) => {
    employeeMap.set(emp.id, emp);
  });

  expensePermissions.forEach((perm) => {
    expenseMap.set(perm.user_id, perm);
  });

  const uniquePermissions = Array.from(
    new Map(trackingPermissions.map((perm) => [perm.user_id, perm])).values()
  );

  return uniquePermissions.map((permission) => {
    const employee = employeeMap.get(permission.user_id);
    const expensePermission = expenseMap.get(permission.user_id);

    return {
      ...permission,
      employee_number: employee?.employee_number,
      email: employee?.email,
      department: employee?.department,
      designation: employee?.designation,
      can_submit_expenses_anytime:
        expensePermission?.can_submit_expenses_anytime,
    };
  });
} 