import { useState } from 'react';
import { useAuth, useBranches } from '@/hooks/useERP';
import { useUserRoles, usePermissions } from '@/hooks/usePermissions';
import { useTranslation } from '@/i18n';
import { 
  UserRole, 
  PERMISSIONS, 
  ROLE_NAMES, 
  ROLE_COLORS,
  DEFAULT_ROLE_PERMISSIONS 
} from '@/lib/permissions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, 
  Shield, 
  UserPlus,
  Settings,
  Search,
  Edit,
  Trash2,
  Check,
  X
} from 'lucide-react';
import { toast } from 'sonner';

// Mock users for demo (in real app, these would come from database)
const DEMO_USERS = [
  { id: 'user-1', name: 'Admin User', email: 'admin@kwanza.ao', username: 'admin' },
  { id: 'user-2', name: 'Manager Silva', email: 'manager@kwanza.ao', username: 'manager' },
  { id: 'user-3', name: 'Caixa João', email: 'joao@kwanza.ao', username: 'joao' },
  { id: 'user-4', name: 'Caixa Maria', email: 'maria@kwanza.ao', username: 'maria' },
];

export default function UserManagement() {
  const { t, language } = useTranslation();
  const { user } = useAuth();
  const { isAdmin } = usePermissions(user?.id);
  const { userRoles, assignRole, removeRole, setCustomPermissions } = useUserRoles();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<typeof DEMO_USERS[0] | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>('viewer');
  const [customPerms, setCustomPerms] = useState<string[]>([]);
  const [useCustomPerms, setUseCustomPerms] = useState(false);

  const filteredUsers = DEMO_USERS.filter(u =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getUserRoleDisplay = (userId: string) => {
    const assignment = userRoles.find(ur => ur.userId === userId);
    return assignment?.role || 'viewer';
  };

  const handleEditUser = (demoUser: typeof DEMO_USERS[0]) => {
    setSelectedUser(demoUser);
    const currentRole = getUserRoleDisplay(demoUser.id);
    setSelectedRole(currentRole);
    
    const assignment = userRoles.find(ur => ur.userId === demoUser.id);
    if (assignment?.customPermissions) {
      setUseCustomPerms(true);
      setCustomPerms(assignment.customPermissions);
    } else {
      setUseCustomPerms(false);
      const rolePerms = DEFAULT_ROLE_PERMISSIONS.find(rp => rp.role === currentRole);
      setCustomPerms(rolePerms?.permissions || []);
    }
    
    setEditDialogOpen(true);
  };

  const handleSaveRole = () => {
    if (!selectedUser) return;
    
    assignRole(selectedUser.id, selectedRole);
    
    if (useCustomPerms) {
      setCustomPermissions(selectedUser.id, customPerms);
    }
    
    toast.success(`Role updated for ${selectedUser.name}`);
    setEditDialogOpen(false);
  };

  const handleRoleChange = (role: UserRole) => {
    setSelectedRole(role);
    if (!useCustomPerms) {
      const rolePerms = DEFAULT_ROLE_PERMISSIONS.find(rp => rp.role === role);
      setCustomPerms(rolePerms?.permissions || []);
    }
  };

  const togglePermission = (permId: string) => {
    setCustomPerms(prev => 
      prev.includes(permId) 
        ? prev.filter(p => p !== permId)
        : [...prev, permId]
    );
  };

  const permissionsByCategory = PERMISSIONS.reduce((acc, perm) => {
    if (!acc[perm.category]) acc[perm.category] = [];
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, typeof PERMISSIONS>);

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardContent className="py-12 text-center">
            <Shield className="w-12 h-12 mx-auto mb-4 text-destructive" />
            <h2 className="text-xl font-bold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">
              You need administrator privileges to access this page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6" />
            User Management
          </h1>
          <p className="text-muted-foreground">
            Manage user roles and permissions
          </p>
        </div>
        <Button>
          <UserPlus className="w-4 h-4 mr-2" />
          Add User
        </Button>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users" className="gap-2">
            <Users className="w-4 h-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-2">
            <Shield className="w-4 h-4" />
            Roles Overview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>All Users</CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map(demoUser => {
                    const role = getUserRoleDisplay(demoUser.id);
                    const assignment = userRoles.find(ur => ur.userId === demoUser.id);
                    const hasCustom = !!assignment?.customPermissions;
                    
                    return (
                      <TableRow key={demoUser.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="font-bold text-primary">
                                {demoUser.name.charAt(0)}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium">{demoUser.name}</p>
                              <p className="text-xs text-muted-foreground">@{demoUser.username}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{demoUser.email}</TableCell>
                        <TableCell>
                          <Badge className={ROLE_COLORS[role]}>
                            {ROLE_NAMES[role]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {hasCustom ? (
                            <Badge variant="outline" className="text-orange-500 border-orange-500">
                              Custom
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">Default</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleEditUser(demoUser)}
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {(Object.keys(ROLE_NAMES) as UserRole[]).map(role => {
              const rolePerms = DEFAULT_ROLE_PERMISSIONS.find(rp => rp.role === role);
              const usersWithRole = userRoles.filter(ur => ur.role === role).length;
              
              return (
                <Card key={role}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <Badge className={ROLE_COLORS[role]}>
                        {ROLE_NAMES[role]}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {usersWithRole} users
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3">
                      {rolePerms?.permissions.length || 0} permissions
                    </p>
                    <div className="space-y-1">
                      {Object.entries(permissionsByCategory).slice(0, 3).map(([cat, perms]) => {
                        const categoryPerms = perms.filter(p => 
                          rolePerms?.permissions.includes(p.id)
                        );
                        return (
                          <div key={cat} className="flex items-center gap-2 text-xs">
                            {categoryPerms.length > 0 ? (
                              <Check className="w-3 h-3 text-green-500" />
                            ) : (
                              <X className="w-3 h-3 text-red-500" />
                            )}
                            <span className="capitalize">{cat}</span>
                            <span className="text-muted-foreground">
                              ({categoryPerms.length}/{perms.length})
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Permission Matrix</CardTitle>
              <CardDescription>
                Overview of permissions by role
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">Permission</TableHead>
                      {(Object.keys(ROLE_NAMES) as UserRole[]).map(role => (
                        <TableHead key={role} className="text-center">
                          <Badge className={ROLE_COLORS[role]} variant="outline">
                            {ROLE_NAMES[role]}
                          </Badge>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(permissionsByCategory).map(([category, perms]) => (
                      <>
                        <TableRow key={category} className="bg-muted/50">
                          <TableCell colSpan={5} className="font-bold capitalize">
                            {category}
                          </TableCell>
                        </TableRow>
                        {perms.map(perm => (
                          <TableRow key={perm.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium text-sm">{perm.name}</p>
                                <p className="text-xs text-muted-foreground">{perm.description}</p>
                              </div>
                            </TableCell>
                            {(Object.keys(ROLE_NAMES) as UserRole[]).map(role => {
                              const rolePerms = DEFAULT_ROLE_PERMISSIONS.find(rp => rp.role === role);
                              const hasIt = rolePerms?.permissions.includes(perm.id);
                              return (
                                <TableCell key={role} className="text-center">
                                  {hasIt ? (
                                    <Check className="w-5 h-5 text-green-500 mx-auto" />
                                  ) : (
                                    <X className="w-5 h-5 text-red-300 mx-auto" />
                                  )}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        ))}
                      </>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User Role & Permissions</DialogTitle>
            <DialogDescription>
              Configure access for {selectedUser?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={selectedRole} onValueChange={(v) => handleRoleChange(v as UserRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLE_NAMES) as UserRole[]).map(role => (
                    <SelectItem key={role} value={role}>
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${ROLE_COLORS[role]}`} />
                        {ROLE_NAMES[role]}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="customPerms"
                checked={useCustomPerms}
                onCheckedChange={(checked) => setUseCustomPerms(!!checked)}
              />
              <Label htmlFor="customPerms">
                Use custom permissions (override role defaults)
              </Label>
            </div>

            {useCustomPerms && (
              <div className="space-y-4 border rounded-lg p-4">
                {Object.entries(permissionsByCategory).map(([category, perms]) => (
                  <div key={category}>
                    <h4 className="font-medium capitalize mb-2">{category}</h4>
                    <div className="grid gap-2 md:grid-cols-2">
                      {perms.map(perm => (
                        <div key={perm.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={perm.id}
                            checked={customPerms.includes(perm.id)}
                            onCheckedChange={() => togglePermission(perm.id)}
                          />
                          <Label htmlFor={perm.id} className="text-sm">
                            {perm.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRole}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
