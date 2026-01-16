import { useState, useCallback, useMemo } from 'react';
import { UserRole, PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } from '@/lib/permissions';

const STORAGE_KEY = 'kwanza_user_roles';

interface UserRoleAssignment {
  userId: string;
  role: UserRole;
  customPermissions?: string[]; // Override default role permissions
}

function getUserRoles(): UserRoleAssignment[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
}

function saveUserRoles(roles: UserRoleAssignment[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(roles));
}

export function useUserRoles() {
  const [userRoles, setUserRoles] = useState<UserRoleAssignment[]>(getUserRoles);

  const assignRole = useCallback((userId: string, role: UserRole) => {
    setUserRoles(prev => {
      const existing = prev.filter(ur => ur.userId !== userId);
      const updated = [...existing, { userId, role }];
      saveUserRoles(updated);
      return updated;
    });
  }, []);

  const removeRole = useCallback((userId: string) => {
    setUserRoles(prev => {
      const updated = prev.filter(ur => ur.userId !== userId);
      saveUserRoles(updated);
      return updated;
    });
  }, []);

  const getUserRole = useCallback((userId: string): UserRole => {
    const assignment = userRoles.find(ur => ur.userId === userId);
    return assignment?.role || 'viewer';
  }, [userRoles]);

  const setCustomPermissions = useCallback((userId: string, permissions: string[]) => {
    setUserRoles(prev => {
      const updated = prev.map(ur => 
        ur.userId === userId 
          ? { ...ur, customPermissions: permissions }
          : ur
      );
      saveUserRoles(updated);
      return updated;
    });
  }, []);

  return {
    userRoles,
    assignRole,
    removeRole,
    getUserRole,
    setCustomPermissions,
  };
}

export function usePermissions(userId: string | undefined) {
  const { getUserRole, userRoles } = useUserRoles();

  const userPermissions = useMemo(() => {
    if (!userId) return [];
    
    const assignment = userRoles.find(ur => ur.userId === userId);
    
    // If custom permissions are set, use those
    if (assignment?.customPermissions) {
      return assignment.customPermissions;
    }
    
    // Otherwise use default role permissions
    const role = getUserRole(userId);
    const rolePerms = DEFAULT_ROLE_PERMISSIONS.find(rp => rp.role === role);
    return rolePerms?.permissions || [];
  }, [userId, userRoles, getUserRole]);

  const hasPermission = useCallback((permissionId: string): boolean => {
    return userPermissions.includes(permissionId);
  }, [userPermissions]);

  const hasAnyPermission = useCallback((permissionIds: string[]): boolean => {
    return permissionIds.some(id => userPermissions.includes(id));
  }, [userPermissions]);

  const hasAllPermissions = useCallback((permissionIds: string[]): boolean => {
    return permissionIds.every(id => userPermissions.includes(id));
  }, [userPermissions]);

  const role = useMemo(() => {
    if (!userId) return 'viewer' as UserRole;
    return getUserRole(userId);
  }, [userId, getUserRole]);

  const isAdmin = role === 'admin';
  const isManager = role === 'manager' || isAdmin;

  return {
    permissions: userPermissions,
    role,
    isAdmin,
    isManager,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
  };
}

// Permission check component
export function usePermissionCheck() {
  const checkPermission = useCallback((userId: string | undefined, permissionId: string): boolean => {
    if (!userId) return false;
    
    const roles = getUserRoles();
    const assignment = roles.find(ur => ur.userId === userId);
    
    if (assignment?.customPermissions) {
      return assignment.customPermissions.includes(permissionId);
    }
    
    const role = assignment?.role || 'viewer';
    const rolePerms = DEFAULT_ROLE_PERMISSIONS.find(rp => rp.role === role);
    return rolePerms?.permissions.includes(permissionId) || false;
  }, []);

  return { checkPermission };
}
