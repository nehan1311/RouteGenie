import { Platform } from "react-native";
import Constants from "expo-constants";

/**
 * Set this to your PC's LAN IP when testing on a physical phone via Expo Go.
 * Run `ipconfig` (Windows) or `ifconfig` (Mac/Linux) to find it.
 */
export const PHYSICAL_DEVICE_LAN_IP = "192.168.29.113";

function resolveApiBaseUrl() {
  if (Platform.OS === "web") {
    return "http://localhost:8000";
  }

  const isPhysicalDevice = Constants.isDevice;

  if (!isPhysicalDevice) {
    if (Platform.OS === "android") {
      return "http://10.0.2.2:8000";
    }
    return "http://localhost:8000";
  }

  return `http://${PHYSICAL_DEVICE_LAN_IP}:8000`;
}

export const API_BASE_URL = resolveApiBaseUrl();

if (__DEV__) {
  console.log("API_BASE_URL:", API_BASE_URL);
}
