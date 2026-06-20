import { AccessRestricted } from "../components/AccessRestricted";
import { useAuth } from "../auth/AuthContext";

export function withRoleGuard(ScreenComponent, allowedRoles = []) {
  return function GuardedScreen(props) {
    const { user, loading } = useAuth();

    if (loading) return null;

    if (!user || !allowedRoles.includes(user.role)) {
      return <AccessRestricted />;
    }

    return <ScreenComponent {...props} />;
  };
}
