import { useEffect } from 'react';
import { Redirect, useRouter, usePathname } from 'expo-router';
import AuthContext from '../context/AuthContext';

type RoleAccess = {
  [key: string]: string[];
};

const ROLE_ACCESS: RoleAccess = {
  '/employee': ['employee'],
  '/group-admin': ['group-admin'],
  '/management': ['management'],
  '/super-admin': ['super-admin'],
};

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = AuthContext.useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!user) return;
    
    // Redirect to appropriate dashboard based on role
    if (pathname === '/signin' || pathname === '/') {
      switch (user.role) {
        case 'employee':
          router.replace('/employee');
          break;
        case 'group-admin':
          router.replace('/group-admin');
          break;
        case 'management':
          router.replace('/management');
          break;
        case 'super-admin':
          router.replace('/super-admin');
          break;
      }
    }
  }, [user, pathname]);

  // Check if user has access to current route
  const currentPath = `/${pathname.split('/')[1]}`;
  const allowedRoles = ROLE_ACCESS[currentPath];

  if (!user && pathname !== '/signin' && pathname !== '/') {
    return <Redirect href="/signin" />;
  }

  if (user && allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to appropriate dashboard if user doesn't have access
    return <Redirect href={`/${user.role}`} />;
  }

  return <>{children}</>;
} 