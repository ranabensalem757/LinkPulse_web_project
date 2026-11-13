export interface User {
  id: string;
  email: string;
  name: string;
  createdAt?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
}

export interface AuthResponse {
  succes: boolean;
  message?: string;
  client: User;
}