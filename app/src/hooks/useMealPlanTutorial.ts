import { useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/context/AuthContext";

function tutorialKey(userId: string) {
  return `tutorial:mealplan:${userId}`;
}

export function useMealPlanTutorial() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);

  const openIfFirstTime = async () => {
    if (!user) return;
    const key = tutorialKey(user.id);
    const alreadySeen = await AsyncStorage.getItem(key);
    if (alreadySeen) return;
    await AsyncStorage.setItem(key, "1");
    setVisible(true);
  };

  const close = () => setVisible(false);

  return { visible, openIfFirstTime, close };
}
