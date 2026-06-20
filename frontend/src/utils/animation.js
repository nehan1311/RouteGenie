import { Platform } from "react-native";

/** Native driver crashes/warns on web — use JS animations instead. */
export const USE_NATIVE_DRIVER = Platform.OS !== "web";
