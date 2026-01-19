// User Management Hook
import { useState, useEffect, useCallback } from 'react';
import { User } from '@/types/erp';
import { UserRole } from '@/lib/permissions';
import * as storage from '@/lib/storage';

export function useUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      // For now, always use localStorage for users
      // TODO: Add backend API endpoint for users when needed
      setUsers(storage.getUsers());
    } catch (error) {
      setUsers(storage.getUsers());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUsers();
  }, [refreshUsers]);

  const createUser = useCallback(async (data: {
    email: string;
    name: string;
    username?: string;
    role: UserRole;
    branchId: string;
    password?: string;
  }): Promise<User> => {
    const newUser = storage.createUser({
      email: data.email,
      name: data.name,
      username: data.username,
      role: data.role,
      branchId: data.branchId,
      isActive: true,
    });
    await refreshUsers();
    return newUser;
  }, [refreshUsers]);

  const updateUser = useCallback(async (user: User): Promise<void> => {
    storage.saveUser(user);
    await refreshUsers();
  }, [refreshUsers]);

  const deleteUser = useCallback(async (userId: string): Promise<void> => {
    storage.deleteUser(userId);
    await refreshUsers();
  }, [refreshUsers]);

  const updateUserRole = useCallback(async (userId: string, role: UserRole): Promise<void> => {
    storage.updateUserRole(userId, role);
    await refreshUsers();
  }, [refreshUsers]);

  const toggleUserActive = useCallback(async (userId: string): Promise<void> => {
    storage.toggleUserActive(userId);
    await refreshUsers();
  }, [refreshUsers]);

  const getUserById = useCallback((userId: string): User | undefined => {
    return users.find(u => u.id === userId);
  }, [users]);

  return {
    users,
    isLoading,
    refreshUsers,
    createUser,
    updateUser,
    deleteUser,
    updateUserRole,
    toggleUserActive,
    getUserById,
  };
}
