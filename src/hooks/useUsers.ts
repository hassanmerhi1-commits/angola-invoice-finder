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
      const data = await storage.getUsers();
      setUsers(data);
    } catch {
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { refreshUsers(); }, [refreshUsers]);

  const createUser = useCallback(async (data: {
    email: string; name: string; username?: string; role: UserRole; branchId: string; password?: string;
  }): Promise<User> => {
    const newUser: User = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      email: data.email, name: data.name, username: data.username,
      role: data.role, branchId: data.branchId, isActive: true,
      createdAt: new Date().toISOString(),
    };
    await storage.saveUser(newUser);
    await refreshUsers();
    return newUser;
  }, [refreshUsers]);

  const updateUser = useCallback(async (user: User): Promise<void> => {
    await storage.saveUser(user);
    await refreshUsers();
  }, [refreshUsers]);

  const deleteUser = useCallback(async (userId: string): Promise<void> => {
    await storage.deleteUser(userId);
    await refreshUsers();
  }, [refreshUsers]);

  const updateUserRole = useCallback(async (userId: string, role: UserRole): Promise<void> => {
    const allUsers = await storage.getUsers();
    const user = allUsers.find(u => u.id === userId);
    if (user) {
      user.role = role;
      user.updatedAt = new Date().toISOString();
      await storage.saveUser(user);
      await refreshUsers();
    }
  }, [refreshUsers]);

  const toggleUserActive = useCallback(async (userId: string): Promise<void> => {
    const allUsers = await storage.getUsers();
    const user = allUsers.find(u => u.id === userId);
    if (user) {
      user.isActive = !user.isActive;
      user.updatedAt = new Date().toISOString();
      await storage.saveUser(user);
      await refreshUsers();
    }
  }, [refreshUsers]);

  const getUserById = useCallback((userId: string): User | undefined => {
    return users.find(u => u.id === userId);
  }, [users]);

  return { users, isLoading, refreshUsers, createUser, updateUser, deleteUser, updateUserRole, toggleUserActive, getUserById };
}
