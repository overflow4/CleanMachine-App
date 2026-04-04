import { useEffect } from "react";
import { useRouter } from "expo-router";

// Login is now handled by the index page (role selection).
// This route exists only as a redirect for any code that navigates to /login.
export default function LoginRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/");
  }, []);
  return null;
}
