import { useEffect } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import { LoadingScreen } from "@/components/ui/LoadingScreen";

export default function Index() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.replace("/(tabs)/overview");
      } else {
        router.replace("/login");
      }
    }
  }, [isAuthenticated, isLoading]);

  return <LoadingScreen message="Loading..." />;
}
