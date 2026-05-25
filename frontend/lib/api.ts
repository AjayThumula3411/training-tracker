import axios from "axios";
import { readAuthToken } from "@/lib/auth-storage";

const api = axios.create({
  baseURL: "/api",
  timeout: 5000,
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = readAuthToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  return config;
});

export default api;
