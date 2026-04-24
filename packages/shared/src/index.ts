export * from "./models";
export * from "./utils/geo";
export * from "./utils/chatAttachment";
export * from "./theme/colors";
export * from "./config/apiConfig";
export * from "./api";
export * from "./utils/storage";
export * from "./hooks/useAuth";
export * from "./hooks/useSocket";
export { AuthProvider, useAuthContext } from "./hooks/AuthContext";
export { CompanyProvider, useCompanyContext } from "./hooks/CompanyContext";
export type { CompanyContextValue } from "./hooks/CompanyContext";
export { SocketProvider } from "./hooks/SocketProvider";
export { initSocket, getSocket, disconnectSocket } from "./socket/socketClient";
export {
  setActiveChatConversationId,
  getActiveChatConversationId,
} from "./chat/chatVisibility";
export type { Capability } from "./roles/roleCapabilities";
export { hasCapability, isElevatedRole } from "./roles/roleCapabilities";
export { formatChatPresence } from "./chat/presence";
export { RegisterExpoPush } from "./push/RegisterExpoPush";
